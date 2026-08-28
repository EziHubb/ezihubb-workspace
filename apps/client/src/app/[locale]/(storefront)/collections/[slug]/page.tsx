import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { CollectionDto } from '@ezihubb/types';
import { buildAlternates } from '../../../../../lib/seo';
import { ListingExplorer } from '../../../../../components/search/ListingExplorer';
import { SearchGridSkeleton } from '../../../../../components/search/SearchProductGrid';
import {
  buildApiParams,
  filtersFromRecord,
  type SearchResponse,
} from '../../../../../components/search/listing-params';
import { CollectionHero } from '../../../../../components/collections/CollectionHero';
import { RelatedCollections } from '../../../../../components/collections/RelatedCollections';
import { warnIfRejected } from '../../../../../lib/warn-if-rejected';

export const dynamic = 'force-dynamic';

type SearchParamValue = string | string[] | undefined;

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const locales = ['en', 'vi'] as const;
  try {
    const res = await apiClient.get<CollectionDto[]>(API_ROUTES.CATALOG.COLLECTIONS, {
      params: { isActive: true, limit: 100 },
      next: { revalidate: 3600 },
    });
    const items = res ?? [];
    const slugs = items.map((c: CollectionDto) => c.slug);
    return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
  } catch {
    return [];
  }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  const collection = await apiClient
    .get<CollectionDto>(API_ROUTES.CATALOG.COLLECTION(slug), {
      next: { revalidate: 300 },
      headers: { 'X-Locale': locale },
    })
    .catch(() => null);

  if (!collection) return { title: 'Collection Not Found' };

  const title = `${collection.name} Gift Ideas`;
  const description = collection.description ??
    `Explore our ${collection.name} collection of personalized handmade gifts. Custom-made to order.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url:    `/collections/${slug}`,
      images: collection.bannerUrl ? [{ url: collection.bannerUrl }] : [],
    },
    alternates: buildAlternates(`/collections/${slug}`, locale),
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params:       Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const { locale, slug } = await params;
  const sp               = await searchParams;

  // The collection is pinned, not chosen, so it is applied here and passed to
  // the grid as a locked filter rather than written into the URL. Everything
  // else comes from the URL exactly as it does on /search — the two pages have
  // to agree on this map or the page the server renders is not the one the
  // client then looks up in its cache.
  const lockedFilters = { collection: slug };
  const apiFilters    = { ...filtersFromRecord(sp), ...lockedFilters };

  const localeHeaders = { 'X-Locale': locale };
  const [collectionRes, resultsRes] = await Promise.allSettled([
    apiClient.get<CollectionDto>(API_ROUTES.CATALOG.COLLECTION(slug), {
      next: { revalidate: 300 },
      headers: localeHeaders,
    }),
    // Same endpoint the grid uses. Fetched here as well so the products are in
    // the HTML this indexed page serves — the grid is client-fetched, and
    // handing it the first page as initialData is what keeps the products
    // crawlable and skips the loading skeleton on first paint.
    apiClient.get<SearchResponse>(API_ROUTES.SEARCH.QUERY, {
      params:  buildApiParams(apiFilters),
      next:    { revalidate: 60 },
      headers: localeHeaders,
    }),
  ]);

  if (collectionRes.status === 'rejected' || !collectionRes.value) notFound();
  const collection = collectionRes.value;

  // A failed product fetch renders the collection as if it were empty, which
  // looks identical to a genuinely empty collection. Log it so the difference
  // is visible in `docker compose logs client`.
  warnIfRejected('collection:products', API_ROUTES.SEARCH.QUERY, resultsRes);

  const initialResults = resultsRes.status === 'fulfilled' ? resultsRes.value : undefined;
  const productCount   = initialResults?.pagination?.total ?? 0;

  // Related collections — non-critical, falls back to null.
  // Same silent-swallow class as the allSettled branches above, just via
  // .catch(): the section below is gated on this being non-empty, so a broken
  // endpoint makes it disappear with nothing logged. Keep the fallback, log
  // the reason.
  const relatedRes = await apiClient
    .get<CollectionDto[]>(API_ROUTES.CATALOG.COLLECTIONS, {
      params: { isActive: true, limit: 4, exclude: slug },
      next: { revalidate: 600 },
    })
    .catch((err: unknown) => {
      warnIfRejected('collection:relatedCollections', API_ROUTES.CATALOG.COLLECTIONS, {
        status: 'rejected',
        reason: err,
      });
      return null;
    });

  // GET /collections answers with a bare array — apiClient has already
  // unwrapped the { success, data } envelope — and the generic above now says
  // so, which is what lets this be a plain read.
  //
  // It used to sniff the shape with Array.isArray at runtime, because reading
  // `.data.length` off the array had thrown during render and served the
  // error boundary for every /collections/* page behind an HTTP 200. The
  // sniffing patched this one call site and left the type lying, so the same
  // mistake survived on the home page and in the admin list, where it showed
  // as "0 collections total" over a database full of them. The type is the
  // fix; the guard was the symptom.
  const related: CollectionDto[] = relatedRes ?? [];

  // Urgency: show if endDate is within 7 days
  let urgencyDays: number | null = null;
  let urgencyDate: string | null = null;
  if (collection.endDate) {
    const msLeft   = new Date(collection.endDate).getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft <= 7) {
      urgencyDays = daysLeft;
      urgencyDate = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        month: 'long', day: 'numeric',
      }).format(new Date(collection.endDate));
    }
  }

  return (
    <>
      <CollectionHero
        collection={collection}
        productCount={productCount}
      />

      {urgencyDays !== null && urgencyDate && (
        <div className="bg-amber-50 border-b border-amber-200 py-2.5 text-center">
          <p className="text-sm font-medium text-amber-800">
            ⏰ This collection ends {urgencyDate} — shop before it&apos;s gone!
          </p>
        </div>
      )}

      <nav
        aria-label="Breadcrumb"
        className="max-w-[1746px] mx-auto px-6 lg:px-12 pt-4 pb-0"
      >
        <ol className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
          <li>
            <Link href={`/${locale}`} className="hover:text-primary transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-border">/</li>
          <li>
            <Link href={`/${locale}/collections`} className="hover:text-primary transition-colors">
              Collections
            </Link>
          </li>
          <li aria-hidden="true" className="text-border">/</li>
          <li className="text-secondary font-medium truncate max-w-[180px]">
            {collection.name}
          </li>
        </ol>
      </nav>

      {/* The same grid, filter column and top bar as /search. No title passed:
          the hero above already carries the collection's name and description,
          and repeating them over the grid was the one thing the old layout
          added here. Suspense because the explorer reads useSearchParams. */}
      <Suspense fallback={<SearchGridSkeleton />}>
        <ListingExplorer
          lockedFilters={lockedFilters}
          showDiscovery={false}
          fillViewport={false}
          initialResults={initialResults}
        />
      </Suspense>

      {related.length > 0 && (
        <RelatedCollections
          collections={related.filter((c) => c.slug !== slug)}
          currentSlug={slug}
          locale={locale}
        />
      )}
    </>
  );
}
