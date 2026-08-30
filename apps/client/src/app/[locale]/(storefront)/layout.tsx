import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { Suspense } from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { StickyHeader } from '../../../components/layout/StickyHeader';
import { Footer } from '../../../components/layout/Footer';
import { MobileBottomNav } from '../../../components/layout/MobileBottomNav';
import { CampaignBannerBar } from '../../../components/campaign/CampaignBannerBar';
import type { MegaMenuTab } from '../../../types/mega-menu';

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
      .get<any>(API_ROUTES.CAMPAIGNS.ACTIVE, { next: { revalidate: 300 } })
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
        <Suspense fallback={<div aria-hidden="true" className="h-16 border-b border-border bg-surface md:h-[112px]" />}>
          <Navbar menuData={menuData} />
        </Suspense>
      </StickyHeader>
      <main id="main-content" tabIndex={-1} className="min-h-screen outline-none">
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
