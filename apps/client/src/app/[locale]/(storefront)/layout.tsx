import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';
import { MobileBottomNav } from '../../../components/layout/MobileBottomNav';
import type { MegaMenuTab } from '../../../types/mega-menu';

// ── Server-side mega menu fetch ────────────────────────────────────────────────
// Cached for 10 minutes — matches the Redis TTL on the API side.
// Falls back gracefully to simple nav links if the API is unavailable.

async function fetchMegaMenu(): Promise<MegaMenuTab[]> {
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002/api/v1';
  try {
    const res = await fetch(`${base}/catalog/mega-menu`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const data = await res.json() as unknown;
    // API wraps in { success, data } envelope OR returns array directly
    if (Array.isArray(data)) return data as MegaMenuTab[];
    const wrapped = data as { data?: MegaMenuTab[] };
    return wrapped.data ?? [];
  } catch {
    // API unavailable at build time — navbar falls back to simple links
    return [];
  }
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const menuData = await fetchMegaMenu();

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
