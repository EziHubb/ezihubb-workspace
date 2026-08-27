/**
 * Which admin routes each kind of session may reach.
 *
 * Lives here, and is called from `middleware.ts`, because a redirect decided
 * in a LAYOUT is not reliable. A layout is a shared segment: on a client-side
 * navigation the App Router may re-render it or serve it from the Router
 * Cache, so the same click could run this guard or skip it entirely — which
 * is exactly the "sometimes it redirects, sometimes it doesn't" this was
 * written to end. Worse, when it did redirect mid-navigation the address bar
 * kept the URL that was clicked while the tree below rendered the target, so
 * the page said Dashboard while the URL said /messages.
 *
 * Middleware has none of those problems: it runs on every matched request,
 * it reads the path from `req.nextUrl` directly, and its redirect is a real
 * HTTP response that the browser and the router both follow. The URL cannot
 * disagree with what is rendered.
 *
 * Pure string work on purpose — no `next/headers`, no session lookup, no
 * Node built-ins — so it runs unchanged on the Edge runtime middleware uses.
 */

import { PLATFORM_ONLY_PREFIXES, SELF_SERVICE_PREFIXES } from './route-categories';
import { isActingAsShopOwner } from './store-context-shared';

/**
 * Returns a redirect path if the given pathname is forbidden for a shop owner
 * (ADMIN role), or null if access is allowed.
 */
export function getShopOwnerRedirect(pathname: string, storeId: string | null): string | null {
  // PLATFORM_ONLY prefixes (apps/admin/src/lib/route-categories.ts) —
  // always redirect to /dashboard. Includes the "/settings/audit-log" and
  // "/settings/affiliates" subtrees specifically — everything else under
  // /settings/* (fulfillment, api-keys, delivery) is the SAME page a shop
  // owner uses for their own store's settings, scoped by store context
  // rather than by URL, so those aren't in the list and stay reachable here.
  if (PLATFORM_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/dashboard';
  }

  // Bare "/settings" (exact match only — NOT a prefix, or it would swallow
  // every /settings/* sub-route above) is the platform-wide General Settings
  // page — super-admin only. Deliberately not in PLATFORM_ONLY_PREFIXES
  // (prefix-matching there would swallow /settings/fulfillment etc. too).
  if (pathname === '/settings') return '/dashboard';

  // Stores list → redirect to own store page
  if (pathname === '/stores' || pathname === '/stores/') {
    return storeId ? `/stores/${storeId}` : '/dashboard';
  }

  // Store sub-routes: guard by storeId
  const storeMatch = pathname.match(/^\/stores\/([^/]+)(\/.*)?$/);
  if (storeMatch) {
    const pathStoreId = storeMatch[1];
    const suffix      = storeMatch[2] ?? '';

    // Permissions management is super-admin only
    if (suffix.startsWith('/permissions')) return '/dashboard';

    // Only allow access to own store
    if (storeId && pathStoreId !== storeId) return `/stores/${storeId}`;

    // Own store's bare page ("General") now lives merged into Shop Home.
    // Redirect there instead of leaving the old moderation-style page
    // reachable — it still writes name/description/banner/logo via
    // StoreEditModal, the exact same fields Shop Home owns, via the same
    // STORE_BANNER/STORE_LOGO endpoints — a second live editor for the same
    // data is what the merge was supposed to remove, not just hide the nav
    // link. SUPER_ADMIN viewing another store is unaffected: this function
    // isn't even called for them (see getAdminRouteRedirect below).
    if (storeId && pathStoreId === storeId && suffix === '') return '/settings/shop-home';
  }

  return null; // allowed
}

/**
 * Returns a redirect path if the given pathname is a SELF_SERVICE-only page
 * (apps/admin/src/lib/route-categories.ts — these pages manage a single
 * store's own operational settings: delivery profiles, offsite-ads opt-out,
 * social posts, Share & Save, payment account, policy violations, search-
 * visibility/service scores, messages) and the caller is a SUPER_ADMIN with
 * no active store context, or null if allowed. Each of these calls an API
 * that resolves the caller's OWN store server-side via
 * StoreContextService.requireStoreId() with no platform-wide aggregate
 * branch (unlike e.g. /settings/fulfillment or /settings/api-keys, which
 * deliberately implement a real cross-store view and so aren't in this
 * list). A SUPER_ADMIN who hasn't switched into a store they own has no
 * storeId to resolve, so these 400 on load — bounce back to the dashboard
 * instead of leaving the page to error. Plain ADMIN shop owners are always
 * scoped to their own store server-side, so this never applies to them.
 */
export function getPlatformContextRedirect(pathname: string, isPlatformContext: boolean): string | null {
  if (!isPlatformContext) return null;
  if (SELF_SERVICE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/dashboard';
  }
  return null;
}

/**
 * Single dispatch point for both guards above. Previously each guard was
 * invoked under its own, mutually-exclusive `if (role === ...)` block —
 * `getShopOwnerRedirect` only for `role === 'ADMIN'`, `getPlatformContextRedirect`
 * only for `isPlatformContext`. That left a SUPER_ADMIN switched into "My
 * Store" (`inStoreMode === true`, so `isPlatformContext === false`) falling
 * through BOTH: not `role === 'ADMIN'`, and not platform-context either — so
 * they could navigate straight to any SUPER_ADMIN-only URL while the sidebar
 * showed the shop-owner nav. Fix: compute "is this request effectively
 * acting as a shop owner" once, for either role, and always dispatch to
 * exactly one of the two existing (unchanged) guards.
 */
export function getAdminRouteRedirect(
  pathname:          string,
  role:              string | undefined,
  storeId:           string | null,
  isPlatformContext: boolean,
): string | null {
  if (isActingAsShopOwner(role, !isPlatformContext)) return getShopOwnerRedirect(pathname, storeId);
  if (role === 'SUPER_ADMIN' && isPlatformContext) return getPlatformContextRedirect(pathname, isPlatformContext);
  return null;
}
