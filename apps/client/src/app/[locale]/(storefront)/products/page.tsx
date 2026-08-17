import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchPageClient } from '../search/SearchPageClient';
import { SearchGridSkeleton } from '../../../../components/search/SearchProductGrid';
import { buildAlternates } from '../../../../lib/seo';

const SEASON_LABELS: Record<string, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall:   'Fall',
  winter: 'Winter',
};

const SEASON_DESC: Record<string, string> = {
  spring: 'Fresh spring gift ideas — personalized blooms, pastels, and garden-inspired designs.',
  summer: 'Sun-filled summer gifts — custom beach bags, personalized drinkware, and outdoor essentials.',
  fall:   'Cozy fall gifts — personalized harvest decor, warm knits, and pumpkin-spice favorites.',
  winter: 'Warm winter gifts — custom holiday ornaments, personalized candles, and cozy printed goods.',
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const season   = sp.season?.toLowerCase();
  const category = sp.category?.trim();
  const q        = sp.q?.trim();

  const seasonLabel = season ? SEASON_LABELS[season] : null;

  const title = q
    ? `"${q}" Products | EziHubb`
    : seasonLabel
      ? `${seasonLabel} Personalized Gifts | EziHubb`
      : category
        ? `${category} Gifts | EziHubb`
        : 'All Personalized Gifts | EziHubb';

  const description = season && SEASON_DESC[season]
    ? SEASON_DESC[season]
    : category
      ? `Shop personalized ${category} gifts, designed by us and printed on demand at EziHubb.`
      : 'Shop personalized gifts designed by us and printed on demand — custom mugs, canvas prints, apparel and more.';

  // Same reasoning as search/page.tsx: free-text `q` results are thin and
  // stay noindexed, but season/category filters render unique, meaningful
  // content and must self-reference their own filtered URL — collapsing
  // every variant to the bare '/products' canonical would tell Google
  // they're all duplicates of the generic listing, undoing the point of
  // giving each its own title/description above.
  const qp = new URLSearchParams();
  if (season)   qp.set('season', season);
  if (category) qp.set('category', category);
  const canonicalPath = qp.size > 0 ? `/products?${qp.toString()}` : '/products';

  return {
    title,
    description,
    robots: { index: !q, follow: true },
    alternates: buildAlternates(canonicalPath, locale),
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<SearchGridSkeleton />}>
      <SearchPageClient />
    </Suspense>
  );
}
