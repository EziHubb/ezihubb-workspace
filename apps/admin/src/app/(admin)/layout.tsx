import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { authOptions } from '../../lib/auth.options';
import { AdminSidebar, AdminMobileNav } from '../../components/layout/AdminSidebar';
import { GetHelpButton } from '../../components/layout/GetHelpButton';
import { STORE_CONTEXT_COOKIE } from '../../lib/store-context';

// ── Route guard helpers ───────────────────────────────────────────────────────

/**
 * Returns a redirect path if the given pathname is forbidden for a shop owner
 * (ADMIN role), or null if access is allowed.
 */
function getShopOwnerRedirect(pathname: string, storeId: string | null): string | null {
  // Strictly super-admin-only prefixes — always redirect to /dashboard
  const superAdminOnly = [
    '/catalog', '/customers', '/payments', '/campaigns', '/affiliates',
    '/moderation', '/finance',
    '/stores/plans', '/stores/settings',
  ];
  if (superAdminOnly.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/dashboard';
  }

  // Bare "/settings" (exact match only — NOT a prefix check, or it would
  // swallow every /settings/* sub-route below) is the platform-wide General
  // Settings page — super-admin only.
  if (pathname === '/settings') return '/dashboard';

  // These specific /settings/* subtrees are ALSO fully super-admin-only.
  // Everything else under /settings/* (fulfillment, api-keys, delivery) is
  // the SAME page a shop owner uses for their own store's settings, scoped
  // by store context rather than by URL — those must stay reachable here.
  const settingsSuperAdminOnlySubtrees = ['/settings/audit-log', '/settings/affiliates'];
  if (settingsSuperAdminOnlySubtrees.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/dashboard';
  }

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
  }

  return null; // allowed
}

// These pages manage a single store's own operational settings (delivery
// profiles, offsite-ads opt-out, social posts, Share & Save, payment
// account, policy violations, search-visibility/service scores) — each
// calls an API that resolves the caller's OWN store server-side via
// StoreContextService.requireStoreId() with no platform-wide aggregate
// branch (unlike e.g. /settings/fulfillment or /settings/api-keys, which
// deliberately implement a real cross-store view for this exact case).
// A SUPER_ADMIN who hasn't switched into a store they own has no storeId to
// resolve, so these 400 on load — not something a platform-wide view can
// fix, since there's no single store's data to show. Bounce back to the
// dashboard instead of leaving the page to error.
const STORE_ONLY_PREFIXES = [
  '/settings/delivery',
  '/marketing/offsite-ads',
  '/marketing/social',
  '/marketing/share-save',
  '/finances',
  '/policy-violations',
  '/search-visibility',
  '/customer-service-stats',
];

/**
 * Returns a redirect path if the given pathname is a store-only page and the
 * caller is a SUPER_ADMIN with no active store context, or null if allowed.
 * Plain ADMIN shop owners are always scoped to their own store server-side
 * (StoreContextService), so this never applies to them.
 */
function getPlatformContextRedirect(pathname: string, isPlatformContext: boolean): string | null {
  if (!isPlatformContext) return null;
  if (STORE_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/dashboard';
  }
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

  if (role === 'ADMIN') {
    const headersList = await headers();
    const pathname    = headersList.get('x-pathname') ?? '';
    const target      = getShopOwnerRedirect(pathname, storeId);
    if (target) redirect(target);
  }

  if (role === 'SUPER_ADMIN') {
    const headersList     = await headers();
    const cookieStore     = await cookies();
    const pathname        = headersList.get('x-pathname') ?? '';
    const storeContext    = cookieStore.get(STORE_CONTEXT_COOKIE)?.value ?? null;
    // Mirrors useAdminMode()'s isPlatformContext on the client: only a
    // SUPER_ADMIN who owns a store can switch into it, and only when the
    // cookie actually matches that store.
    const inStoreMode      = !!storeId && storeContext === storeId;
    const isPlatformContext = !inStoreMode;
    const target = getPlatformContextRedirect(pathname, isPlatformContext);
    if (target) redirect(target);
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <AdminSidebar />

      {/* Right column: mobile top bar + scrollable content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminMobileNav />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 min-w-0">
          {children}
        </main>
      </div>

      <GetHelpButton />
    </div>
  );
}
