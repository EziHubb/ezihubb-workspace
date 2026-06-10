/**
 * Unified API client entry point for apps/client.
 *
 * - `apiClient` / `api` — for client-side components (browser fetch with in-memory token)
 * - `serverApi`         — for RSC pages, metadata functions, sitemap (forwards cookies)
 * - `API_BASE`          — normalized base URL for file-upload XHR calls
 */

// ── Client-side helpers ───────────────────────────────────────────────────────

export {
  api,
  apiClient,
  apiFetch,
  setBaseUrl,
  setTokenGetter,
  setTokenUpdater,
} from './api';

export type { RequestOptions } from './api';

// ── Normalized base URL ───────────────────────────────────────────────────────

export const API_BASE = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002')
  .replace(/\/api\/v1\/?$/, '');

// ── Server-side helper (RSC pages, metadata, sitemap) ─────────────────────────

type ServerApiInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * Fetch from an RSC context, forwarding the incoming request cookies so
 * authenticated endpoints receive the httpOnly refresh / access cookies.
 * Returns `null` on any error rather than throwing (caller decides whether
 * to call `notFound()` or render a fallback).
 */
export async function serverApi<T>(
  path: string,
  init?: ServerApiInit,
): Promise<T | null> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');

    const url = path.startsWith('/api/')
      ? `${API_BASE}${path}`
      : `${API_BASE}/api/v1${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(init?.headers as Record<string, string>),
      },
    });

    if (!res.ok) return null;
    const json = await res.json() as { data?: T };
    return (json?.data ?? json) as T;
  } catch {
    return null;
  }
}
