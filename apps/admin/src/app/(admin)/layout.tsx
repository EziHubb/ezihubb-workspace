import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { authOptions } from '../../lib/auth.options';
import { AdminSidebar, AdminMobileNav } from '../../components/layout/AdminSidebar';
import { TabTitleBadge } from '../../components/layout/TabTitleBadge';
// import { GetHelpButton } from '../../components/layout/GetHelpButton'; // temporarily unmounted — see below
import { resolveInStoreMode, STORE_CONTEXT_COOKIE } from '../../lib/store-context-shared';
import { ServerStoreModeProvider } from '../../lib/server-store-mode';
import { getAdminRouteRedirect } from '../../lib/route-guard';

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

  // A backstop, not the guard. middleware.ts now makes this same call on
  // every request and redirects there, where it is an ordinary HTTP redirect
  // the browser follows — so in practice this never fires. It is kept for the
  // case the middleware matcher stops covering a path: a guard that silently
  // stops running is how a shop owner reaches a platform-only page.
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
