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
