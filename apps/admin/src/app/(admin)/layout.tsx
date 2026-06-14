import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { authOptions } from '../../lib/auth.options';
import { AdminSidebar, AdminMobileNav } from '../../components/layout/AdminSidebar';

// Routes that only SUPER_ADMIN can access.
// Shop owners (ADMIN role) use the same shared routes (/products, /orders, etc.)
// but the API scopes their data to their own store automatically.
const SUPER_ADMIN_ONLY_PREFIXES = [
  '/catalog',
  '/customers',
  '/payments',
  '/campaigns',
  '/affiliates',
  '/creators',
  '/ai',
  '/moderation',
  '/settings',
  '/referrals',
  '/finance',
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown> | undefined;
  const role = user?.['role'] as string | undefined;

  // Shop owners are blocked from super-admin-only routes
  if (role === 'ADMIN') {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') ?? '';
    const isForbidden = SUPER_ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
    if (isForbidden) redirect('/dashboard');
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
