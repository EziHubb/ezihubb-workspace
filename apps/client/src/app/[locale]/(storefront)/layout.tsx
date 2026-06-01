import { apiClient } from '@mlh/api-client';
import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';
import { MobileBottomNav } from '../../../components/layout/MobileBottomNav';
import type { MegaMenuTab } from '../../../types/mega-menu';

// ── Server-side mega menu fetch ────────────────────────────────────────────────
// Cached for 10 minutes — matches the Redis TTL on the API side.
// Falls back gracefully to empty nav links if the API is unavailable.

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // apiClient auto-unwraps the envelope; result is MegaMenuTab[] directly
  const menuData = await apiClient
    .get<MegaMenuTab[]>('/catalog/mega-menu', {
      next: { revalidate: 600 },
    })
    .catch(() => [] as MegaMenuTab[]);

  return (
    <>
      <Navbar menuData={menuData} />
      <main className="pt-16 md:pt-[60px] min-h-screen">
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
