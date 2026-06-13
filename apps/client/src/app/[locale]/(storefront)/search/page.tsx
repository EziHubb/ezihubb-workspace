import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchPageClient } from './SearchPageClient';
import { SearchGridSkeleton } from '../../../../components/search/SearchProductGrid';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const q = params.q?.trim();
  return {
    title: q
      ? `"${q}" — Personalized Gifts | DailyDaisy`
      : 'Search Personalized Gifts | DailyDaisy',
    description: q
      ? `Find the perfect personalized "${q}" gift. Custom-made with love at DailyDaisy.`
      : 'Search 120+ personalized gift ideas. Custom mugs, canvas prints, apparel and more.',
    robots: { index: false, follow: true },
  };
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchGridSkeleton />}>
      <SearchPageClient />
    </Suspense>
  );
}
