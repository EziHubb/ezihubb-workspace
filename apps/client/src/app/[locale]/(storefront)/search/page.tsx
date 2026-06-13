import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchPageClient } from './SearchPageClient';
import { SearchGridSkeleton } from '../../../../components/search/SearchProductGrid';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const q = params.q?.trim();
  const category = params.category?.trim();
  const title = q
    ? `"${q}" — Personalized Gifts | DailyDaisy`
    : category
      ? `${category} Gifts | DailyDaisy`
      : 'All Personalized Gifts | DailyDaisy';
  const description = q
    ? `Find the perfect personalized "${q}" gift. Custom-made with love at DailyDaisy.`
    : 'Shop 120+ personalized gift ideas — custom mugs, canvas prints, apparel and more.';
  return {
    title,
    description,
    robots: { index: !q, follow: true },
    alternates: { canonical: '/search' },
  };
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchGridSkeleton />}>
      <SearchPageClient />
    </Suspense>
  );
}
