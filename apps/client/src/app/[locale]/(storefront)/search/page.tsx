import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchPageClient } from './SearchPageClient';
import { SearchGridSkeleton } from '../../../../components/search/SearchProductGrid';
import { buildAlternates } from '../../../../lib/seo';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim();
  const category = sp.category?.trim();
  const title = q
    ? `"${q}" — Personalized Gifts | EziHubb`
    : category
      ? `${category} Gifts | EziHubb`
      : 'All Personalized Gifts | EziHubb';
  const description = q
    ? `Find the perfect personalized "${q}" gift. Custom-made with love at EziHubb.`
    : 'Shop 120+ personalized gift ideas — custom mugs, canvas prints, apparel and more.';
  // Free-text search results are thin/duplicate-prone and stay noindexed
  // (robots.index below), but a category filter renders unique, meaningful
  // content — canonicalizing it away to the bare '/search' would tell Google
  // it's a duplicate of the unfiltered page, undoing the point of giving it
  // its own title/description above.
  const canonicalPath = category ? `/search?category=${encodeURIComponent(category)}` : '/search';

  return {
    title,
    description,
    robots: { index: !q, follow: true },
    alternates: buildAlternates(canonicalPath, locale),
  };
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchGridSkeleton />}>
      <SearchPageClient />
    </Suspense>
  );
}
