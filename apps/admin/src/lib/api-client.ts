import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { getSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth.options';
import { getStoreContext, STORE_CONTEXT_HEADER, STORE_CONTEXT_COOKIE } from './store-context';

// ── Base URL ──────────────────────────────────────────────────────────────────

function buildBase(): string {
  const raw =
    process.env['API_URL'] ??
    process.env['NEXT_PUBLIC_API_URL'] ??
    'http://localhost:3002';
  return raw.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') + '/api/v1';
}

export const API_BASE = buildBase();

// Strip a leading /api/v1 so callers never need to include it.
function p(path: string): string {
  return path.replace(/^\/api\/v1(?=\/|$)/, '');
}

// The API wraps every response as `{ success, data, meta }` (see
// TransformInterceptor). Unwrapping with `body.data ?? body` breaks the very
// common case of a legitimately-null payload (e.g. "no bank account yet") —
// `null ?? body` falls through to `body`, returning the whole envelope
// object instead of `null`. That envelope is truthy and has none of the real
// fields, so a `data ? <has-value UI> : <empty-state UI>` check in a caller
// picks the wrong branch. Checking for the `data` key's presence (not its
// value) distinguishes "enveloped, value is null" from "not enveloped at
// all" the `??` version couldn't.
function unwrapEnvelope<T>(body: { data?: T } | T): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

// ── Typed error ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Backend's HttpExceptionFilter always emits { error: { code, message } }
    // (apps/api/src/common/filters/http-exception.filter.ts) — surfaced here
    // so callers can branch on a specific code (e.g. 'ERR_PLUS_REQUIRED')
    // instead of matching on the human-readable message string.
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function extractMessage(err: AxiosError): string {
  const data = err.response?.data as { error?: { message?: string } } | undefined;
  return data?.error?.message ?? err.message ?? `HTTP ${err.response?.status ?? 0}`;
}

function extractCode(err: AxiosError): string | undefined {
  const data = err.response?.data as { error?: { code?: string } } | undefined;
  return data?.error?.code;
}

// ── Client-side axios instance ("use client" components) ──────────────────────

export const adminApi = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

adminApi.interceptors.request.use(async (config) => {
  const session = await getSession();
  const token = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const storeContext = getStoreContext();
  if (storeContext) config.headers[STORE_CONTEXT_HEADER] = storeContext;

  // A FormData body must NOT go out with the instance's JSON content-type.
  //
  // axios ≥1 does more than mislabel it — transformRequest reads:
  //
  //     if (isFormData) {
  //       return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
  //     }
  //
  // so with `Content-Type: application/json` set as an instance default, every
  // FormData upload is silently CONVERTED to JSON. A File has no enumerable own
  // properties, so the payload the server receives is `{"video":{}}` — a valid
  // JSON request carrying no file at all. Multer then finds no multipart body
  // and the handler's file argument is undefined.
  //
  // That failed quietly: it looked like a server-side upload bug rather than a
  // header default, because the request succeeded at the transport level and
  // arrived at the right route with valid auth.
  //
  // Deleting the header here lets the browser set `multipart/form-data` with
  // its own boundary, which is the one thing application code cannot do itself
  // (the boundary must match the encoded body).
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }

  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    throw new ApiError(err.response?.status ?? 0, extractMessage(err), extractCode(err));
  },
);

// ── Typed client helpers (client-side) ───────────────────────────────────────

async function request<T>(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await adminApi.request<{ data?: T } | T>({
    method,
    url: p(path),
    data,
    ...config,
  });
  return unwrapEnvelope<T>(res.data as { data?: T } | T);
}

export const api = {
  get:    <T>(path: string, config?: AxiosRequestConfig) => request<T>('get', path, undefined, config),
  post:   <T>(path: string, data?: unknown, config?: AxiosRequestConfig) => request<T>('post', path, data, config),
  put:    <T>(path: string, data?: unknown, config?: AxiosRequestConfig) => request<T>('put', path, data, config),
  patch:  <T>(path: string, data?: unknown, config?: AxiosRequestConfig) => request<T>('patch', path, data, config),
  delete: <T>(path: string, config?: AxiosRequestConfig) => request<T>('delete', path, undefined, config),
};

// ── Server-side helper (Server Components, Route Handlers) ───────────────────

const serverAxios = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

serverAxios.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    throw new ApiError(err.response?.status ?? 0, extractMessage(err), extractCode(err));
  },
);

export async function serverApi<T>(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const session = await getServerSession(authOptions);
  const token = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;

  // Dynamic import — `next/headers` must never be a static import in a module
  // also pulled into client components (that's a Next.js build error). Reads
  // the same cookie the sidebar's store-context switcher writes client-side
  // (apps/admin/src/lib/store-context.ts), so a SUPER_ADMIN's "My Store" mode
  // also scopes server-rendered pages, not just client-fetched ones.
  const { cookies } = await import('next/headers');
  const storeContext = (await cookies()).get(STORE_CONTEXT_COOKIE)?.value;

  const res = await serverAxios.request<{ data?: T } | T>({
    method,
    url: p(path),
    data,
    ...config,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(storeContext ? { [STORE_CONTEXT_HEADER]: storeContext } : {}),
      ...(config?.headers as Record<string, string> | undefined),
    },
  });
  return unwrapEnvelope<T>(res.data as { data?: T } | T);
}

