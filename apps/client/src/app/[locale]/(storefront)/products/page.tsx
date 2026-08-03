import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchPageClient } from '../search/SearchPageClient';
import { SearchGridSkeleton } from '../../../../components/search/SearchProductGrid';

const SEASON_LABELS: Record<string, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall:   'Fall',
  winter: 'Winter',
};

const SEASON_DESC: Record<string, string> = {
  spring: 'Fresh spring gift ideas — personalized blooms, pastels, and garden-inspired handmade goods.',
  summer: 'Sun-filled summer gifts — custom beach bags, personalized drinkware, and outdoor essentials.',
  fall:   'Cozy fall gifts — personalized harvest decor, warm knits, and pumpkin-spice favorites.',
  winter: 'Warm winter gifts — custom holiday ornaments, personalized candles, and cozy handmade goods.',
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const season   = params.season?.toLowerCase();
  const category = params.category?.trim();
  const q        = params.q?.trim();

  const seasonLabel = season ? SEASON_LABELS[season] : null;

  const title = q
    ? `"${q}" Products | EziHubb`
    : seasonLabel
      ? `${seasonLabel} Gifts & Handmade Goods | EziHubb`
      : category
        ? `${category} Gifts | EziHubb`
        : 'All Handmade Gifts | EziHubb';

  const description = season && SEASON_DESC[season]
    ? SEASON_DESC[season]
    : category
      ? `Shop personalized ${category} gifts handmade with love at EziHubb.`
      : 'Shop 120+ personalized handmade gifts — custom mugs, canvas prints, apparel and more.';

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: '/products' },
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
