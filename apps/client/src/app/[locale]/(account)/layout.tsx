import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { apiClient } from '@ezihubb/api-client';
import { authOptions } from '../../../lib/auth.options';
import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';
import { MobileBottomNav } from '../../../components/layout/MobileBottomNav';
import AccountLayoutClient from './AccountLayoutClient';
import type { MegaMenuTab } from '../../../types/mega-menu';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Server-side auth guard — redirect before any HTML is sent to the browser.
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/login`);

  const menuData = await apiClient
    .get<MegaMenuTab[]>('/catalog/mega-menu', { next: { revalidate: 600 } })
    .catch(() => [] as MegaMenuTab[]);

  return (
    <>
      <Navbar menuData={menuData} />
      <main className="pt-16 md:pt-[112px] min-h-screen">
        <AccountLayoutClient>{children}</AccountLayoutClient>
      </main>
      <div className="pb-16 md:pb-0">
        <Footer />
      </div>
      <MobileBottomNav />
    </>
  );
}
