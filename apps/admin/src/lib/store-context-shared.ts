// Plain functions only — deliberately NOT in store-context.ts, which is a
// 'use client' module. Next.js's RSC bundler turns every export of a
// 'use client' file into a client reference, so calling one directly from a
// Server Component (not rendering it as JSX) throws at runtime: "Attempted
// to call X() from the server but X is on the client" — this passes
// `tsc`/webpack type-checking silently and only breaks at request time,
// which is how a previous version of this fix crashed every admin page in
// production. Both `(admin)/layout.tsx` (Server Component) and
// `store-context.ts`'s `useAdminMode()` (Client Component hook) import from
// here instead.

/**
 * The cookie the store-context switcher writes, and the header the API reads
 * it back as.
 *
 * These live HERE, not in store-context.ts, for the same reason the functions
 * below do — and this is not a style preference. Every export of a
 * 'use client' module becomes a client reference in the RSC graph, values
 * included. A Server Component that imported the name from there did not get
 * the string "ezihubb-store-context"; it got a reference object, so
 * `cookies().get(...)` looked up a cookie that does not exist and returned
 * undefined every time.
 *
 * Nothing threw. `resolveInStoreMode()` simply answered `false` forever, so a
 * SUPER_ADMIN could click "Viewing: Platform" as often as they liked and the
 * page always came back platform-scoped. Three Server-side callers had it
 * wrong at once: `(admin)/layout.tsx`, `(admin)/dashboard/page.tsx` and
 * `serverApi()`, which meant server-rendered pages never sent the header
 * either.
 *
 * Import them from this file. store-context.ts deliberately does NOT
 * re-export them: a re-export from a 'use client' module is a client
 * reference again, which would quietly restore the same bug.
 */
export const STORE_CONTEXT_COOKIE = 'ezihubb-store-context';
export const STORE_CONTEXT_HEADER = 'X-Store-Context';

/**
 * Given the caller's own storeId and whatever the store-context cookie
 * currently holds, decides whether they're switched into "My Store" mode.
 * No `document`/`cookies()` access itself, so it works identically whether
 * the caller read the cookie via `getStoreContext()` (client) or
 * `cookies()` from `next/headers` (server).
 */
export function resolveInStoreMode(ownStoreId: string | null, storeContextCookie: string | null): boolean {
  return !!ownStoreId && storeContextCookie === ownStoreId;
}

/**
 * "Is this request/session effectively acting as a shop owner" — true for a
 * plain ADMIN, or a SUPER_ADMIN currently switched into their own store.
 * The single boolean both `(admin)/layout.tsx`'s route guard and any
 * split-UI page (e.g. dashboard/page.tsx) need; kept here as one definition
 * so the two don't drift the way the layout guard's two independent checks
 * once did (see route-categories.ts for the full story).
 */
export function isActingAsShopOwner(role: string | undefined, inStoreMode: boolean): boolean {
  return role === 'ADMIN' || (role === 'SUPER_ADMIN' && inStoreMode);
}
