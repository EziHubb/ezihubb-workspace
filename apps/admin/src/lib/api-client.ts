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

// ── Typed error ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function extractMessage(err: AxiosError): string {
  const data = err.response?.data as { error?: { message?: string } } | undefined;
  return data?.error?.message ?? err.message ?? `HTTP ${err.response?.status ?? 0}`;
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
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    throw new ApiError(err.response?.status ?? 0, extractMessage(err));
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
  const body = res.data as { data?: T } | T;
  return ((body as { data?: T }).data ?? body) as T;
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
    throw new ApiError(err.response?.status ?? 0, extractMessage(err));
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
  const body = res.data as { data?: T } | T;
  return ((body as { data?: T }).data ?? body) as T;
}

