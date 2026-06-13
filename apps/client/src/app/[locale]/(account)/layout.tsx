import type { Metadata } from 'next';
import { apiClient } from '@mlh/api-client';
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
}: {
  children: React.ReactNode;
}) {
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
