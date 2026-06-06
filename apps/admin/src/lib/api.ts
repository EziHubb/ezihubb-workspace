import { getServerSession } from 'next-auth';
import { getSession } from 'next-auth/react';
import { authOptions } from './auth.options';

// ── API base URL ──────────────────────────────────────────────────────────────
// Normalise to always include /api/v1 regardless of how env var is set.

function buildBase(): string {
  const raw =
    process.env['API_URL']               // server-only var (preferred)
    ?? process.env['NEXT_PUBLIC_API_URL'] // build-time public var
    ?? 'http://localhost:3002';

  return raw.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') + '/api/v1';
}

export const API_BASE = buildBase();
const BASE = API_BASE;

// Strip a leading /api/v1 so callers never need to include it —
// BASE already ends with /api/v1, so including it again would double it.
function p(path: string): string {
  return path.replace(/^\/api\/v1(?=\/|$)/, '');
}

// ── Server-side fetch (Server Components, Route Handlers) ─────────────────────
// MUST pass authOptions to getServerSession() so NextAuth can read the JWT config.

export async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await getServerSession(authOptions);
  const token   = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;

  return fetch(`${BASE}${p(path)}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

// ── Client-side fetch ("use client" components) ───────────────────────────────

export async function clientFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await getSession();
  const token   = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;

  return fetch(`${BASE}${p(path)}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

// ── API error (carries HTTP status so callers can react to 401 etc.) ─────────

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Typed helper ──────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path:    string,
  init?:   RequestInit,
  server = false,
): Promise<T> {
  const res  = await (server ? serverFetch(path, init) : clientFetch(path, init));
  const body = await res.json();
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return ((body as { data?: T }).data ?? body) as T;
}
