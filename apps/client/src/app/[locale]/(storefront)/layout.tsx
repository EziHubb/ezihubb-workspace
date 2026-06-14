import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';
import { MobileBottomNav } from '../../../components/layout/MobileBottomNav';
import { CampaignBannerBar } from '../../../components/campaign/CampaignBannerBar';
import type { MegaMenuTab } from '../../../types/mega-menu';

export const dynamic = 'force-dynamic';

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuData, activeCampaign] = await Promise.all([
    apiClient
      .get<MegaMenuTab[]>('/catalog/mega-menu', { next: { revalidate: 600 } })
      .catch(() => [] as MegaMenuTab[]),
    apiClient
      .get<any>(API_ROUTES.CAMPAIGNS.ACTIVE)
      .catch(() => null),
  ]);

  return (
    <>
      {/* Sticky header: campaign banner (when active) + navbar */}
      <div className="sticky top-0 z-50">
        <CampaignBannerBar campaign={activeCampaign} />
        <Navbar menuData={menuData} />
      </div>
      <main className="min-h-screen">
        {children}
      </main>
      {/* Extra bottom padding on mobile so content clears the fixed MobileBottomNav */}
      <div className="pb-16 md:pb-0">
        <Footer />
      </div>
      <MobileBottomNav />
    </>
  );
}
