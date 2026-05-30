/**
 * API client for apps/client.
 *
 * This module re-exports the shared `@mlh/api-client` so every file in the
 * client app imports from one place. It also ensures the correct API base URL
 * is set for server-side rendering (SSR / RSC) environments where the env var
 * may need to be explicitly applied.
 *
 * Token management:
 *   The auth store (`lib/store/auth.store.ts`) registers an in-memory token
 *   getter/updater with the shared client via `setTokenGetter`/`setTokenUpdater`.
 *   This wiring happens at module-import time on the client. Server-side calls
 *   (RSC, server actions) do not attach bearer tokens — they rely on cookies.
 */

import { setBaseUrl } from '@mlh/api-client';

// Ensure the base URL is always correct, even in environments where the env
// var is read after the shared library's module-level initialiser ran.
const apiUrl = process.env['NEXT_PUBLIC_API_URL'];
if (apiUrl) {
  setBaseUrl(apiUrl);
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export {
  api,
  apiFetch,
  setBaseUrl,
  setTokenGetter,
  setTokenUpdater,
} from '@mlh/api-client';

export type { RequestOptions } from '@mlh/api-client';
