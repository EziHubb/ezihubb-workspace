import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { authOptions } from '../../lib/auth.options';
import { AdminSidebar, AdminMobileNav } from '../../components/layout/AdminSidebar';
import { TabTitleBadge } from '../../components/layout/TabTitleBadge';
// import { GetHelpButton } from '../../components/layout/GetHelpButton'; // temporarily unmounted — see below
import { isActingAsShopOwner, resolveInStoreMode, STORE_CONTEXT_COOKIE } from '../../lib/store-context-shared';
import { ServerStoreModeProvider } from '../../lib/server-store-mode';
import { PLATFORM_ONLY_PREFIXES, SELF_SERVICE_PREFIXES } from '../../lib/route-categories';

// ── Route guard helpers ───────────────────────────────────────────────────────

/**
 * Returns a redirect path if the given pathname is forbidden for a shop owner
 * (ADMIN role), or null if access is allowed.
 */
function getShopOwnerRedirect(pathname: string, storeId: string | null): string | null {
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
function getPlatformContextRedirect(pathname: string, isPlatformContext: boolean): string | null {
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
function getAdminRouteRedirect(
  pathname:          string,
  role:              string | undefined,
  storeId:           string | null,
  isPlatformContext: boolean,
): string | null {
  if (isActingAsShopOwner(role, !isPlatformContext)) return getShopOwnerRedirect(pathname, storeId);
  if (role === 'SUPER_ADMIN' && isPlatformContext) return getPlatformContextRedirect(pathname, isPlatformContext);
  return null;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const user    = session.user as Record<string, unknown> | undefined;
  const role    = user?.['role']    as string | undefined;
  const storeId = user?.['storeId'] as string | null | undefined ?? null;

  const headersList  = await headers();
  const cookieStore   = await cookies();
  const pathname      = headersList.get('x-pathname') ?? '';
  const storeContext  = cookieStore.get(STORE_CONTEXT_COOKIE)?.value ?? null;
  // Mirrors useAdminMode()'s isPlatformContext on the client: only a
  // SUPER_ADMIN who owns a store can switch into it, and only when the
  // cookie actually matches that store. Computed regardless of role so the
  // dispatch above can be unconditional too.
  const inStoreMode       = resolveInStoreMode(storeId, storeContext);
  const isPlatformContext = !inStoreMode;

  const target = getAdminRouteRedirect(pathname, role, storeId, isPlatformContext);
  if (target) redirect(target);

  return (
    // The sidebar and every client page below read the mode from here rather
    // than recomputing it from the cookie. One answer, decided where the page
    // content was decided, so the two halves cannot contradict each other.
    <ServerStoreModeProvider inStoreMode={inStoreMode}>
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <AdminSidebar />

      {/* Right column: mobile top bar + scrollable content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminMobileNav />

        {/* Renders nothing — it owns the tab title, and lives here so the
            count survives navigation between admin pages the way the
            sidebar's own socket listener does. */}
        <TabTitleBadge />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8 min-w-0">
          {children}
        </main>
      </div>

      {/* Temporarily hidden across the admin: it is fixed to the bottom-right
          and sat on top of the listing editor's Publish button, which is worse
          than not having a help affordance at all. Bring it back once it can
          get out of the way of the page's own actions. */}
      {/* <GetHelpButton /> */}
    </div>
    </ServerStoreModeProvider>
  );
}
