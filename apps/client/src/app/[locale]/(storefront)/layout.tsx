import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { Navbar } from '../../../components/layout/Navbar';
import { StickyHeader } from '../../../components/layout/StickyHeader';
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
      {/* Sticky header: campaign banner (when active) + navbar.
          StickyHeader slides it out of view on scroll-down and brings it back
          on scroll-up, so a long page (the product gallery especially) gets
          the ~112px back instead of carrying navigation nobody is using. */}
      <StickyHeader>
        <CampaignBannerBar campaign={activeCampaign} />
        <Navbar menuData={menuData} />
      </StickyHeader>
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
