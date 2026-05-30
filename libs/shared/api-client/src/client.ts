import { ApiRequestError } from '@mlh/types';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

let baseUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

export function setBaseUrl(url: string): void {
  baseUrl = url;
}

// ── Token provider (registered by auth store) ─────────────────────────────────

type TokenGetter  = () => string | null;
type TokenUpdater = (token: string | null) => void;

let _tokenGetter:  TokenGetter  = () => null;     // returns in-memory access token
let _tokenUpdater: TokenUpdater = () => undefined; // called when token is refreshed

/**
 * Register an in-memory token provider from the auth store.
 * Must be called during app initialisation so API calls use the correct token.
 */
export function setTokenGetter(getter: TokenGetter): void {
  _tokenGetter = getter;
}

/**
 * Register a callback that is invoked whenever the API client silently
 * refreshes the access token (on 401). The auth store uses this to keep
 * its in-memory copy in sync.
 */
export function setTokenUpdater(updater: TokenUpdater): void {
  _tokenUpdater = updater;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  // 1. In-memory token from auth store (preferred)
  const memToken = _tokenGetter();
  if (memToken) return { Authorization: `Bearer ${memToken}` };

  return {};
}

async function refreshTokens(): Promise<string | null> {
  try {
    const res = await fetch(buildUrl('/auth/refresh'), {
      method:      'POST',
      credentials: 'include', // sends httpOnly refresh cookie
    });
    if (!res.ok) {
      _tokenUpdater(null); // clear stale token
      return null;
    }
    const json  = await res.json();
    const token: string | null = json?.data?.accessToken ?? null;
    if (token) {
      _tokenUpdater(token); // update auth store in-memory token
    }
    return token;
  } catch {
    return null;
  }
}

// ── Core fetch ────────────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers: extraHeaders, ...rest } = options;

  const doFetch = async (withAuth: boolean): Promise<Response> => {
    const authHeader = withAuth ? getAuthHeader() : {};
    return fetch(buildUrl(path, params), {
      credentials: 'include',
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        Accept:         'application/json',
        ...authHeader,
        ...(extraHeaders as Record<string, string>),
      },
    });
  };

  let res = await doFetch(true);

  // Auto-refresh on 401
  if (res.status === 401) {
    const newToken = await refreshTokens();
    if (newToken) {
      res = await doFetch(true);
    }
  }

  let body: unknown;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    const err = body as Partial<ApiRequestError>;
    throw new ApiRequestError(
      res.status,
      typeof err?.message === 'string' ? err.message : `HTTP ${res.status}`,
      err?.errors,
    );
  }

  // Unwrap { success, data } envelope
  if (
    body !== null &&
    typeof body === 'object' &&
    'success' in (body as object) &&
    'data' in (body as object)
  ) {
    return (body as { data: T }).data;
  }

  return body as T;
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string, opts?: RequestOptions) =>
    apiFetch<T>(path, { method: 'GET', ...opts }),

  post:   <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),

  patch:  <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),

  put:    <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body), ...opts }),

  delete: <T>(path: string, opts?: RequestOptions) =>
    apiFetch<T>(path, { method: 'DELETE', ...opts }),
};
