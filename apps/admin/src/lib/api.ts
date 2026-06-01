import { getServerSession } from 'next-auth';
import { getSession } from 'next-auth/react';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002/api/v1';

// ── Server-side fetch (Server Components, Route Handlers) ─────────────────────

export async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await getServerSession();
  const token   = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;

  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

// ── Client-side fetch ("use client" components) ───────────────────────────────

export async function clientFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await getSession();
  const token   = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;

  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path:    string,
  init?:   RequestInit,
  server = false,
): Promise<T> {
  const res  = await (server ? serverFetch(path, init) : clientFetch(path, init));
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return (body.data ?? body) as T;
}
