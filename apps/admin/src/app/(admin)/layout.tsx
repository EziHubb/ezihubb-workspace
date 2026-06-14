import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { authOptions } from '../../lib/auth.options';
import { AdminSidebar, AdminMobileNav } from '../../components/layout/AdminSidebar';

// ── Route guard helpers ───────────────────────────────────────────────────────

/**
 * Returns a redirect path if the given pathname is forbidden for a shop owner
 * (ADMIN role), or null if access is allowed.
 */
function getShopOwnerRedirect(pathname: string, storeId: string | null): string | null {
  // Strictly super-admin-only prefixes — always redirect to /dashboard
  const superAdminOnly = [
    '/catalog', '/customers', '/payments', '/campaigns', '/affiliates',
    '/creators', '/ai', '/moderation', '/settings', '/referrals', '/finance',
    '/stores/plans', '/stores/settings',
  ];
  if (superAdminOnly.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/dashboard';
  }

  // Flash deals review queue is super-admin only; /submit is fine for sellers
  if (
    pathname === '/flash-deals' ||
    (pathname.startsWith('/flash-deals/') && !pathname.startsWith('/flash-deals/submit'))
  ) {
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
    </div>
  );
}
