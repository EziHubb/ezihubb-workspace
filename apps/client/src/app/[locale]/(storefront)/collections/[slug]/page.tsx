import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { CollectionDto, ProductListItemDto } from '@ezihubb/types';
import type { PaginatedResponse } from '@ezihubb/types';
import { buildAlternates } from '../../../../../lib/seo';
import { ProductListingLayout } from '../../../../../components/listing/ProductListingLayout';
import { CollectionHero } from '../../../../../components/collections/CollectionHero';
import { RelatedCollections } from '../../../../../components/collections/RelatedCollections';
import { parseSearchParams } from '../../../../../components/listing/types';
import { warnIfRejected } from '../../../../../lib/warn-if-rejected';

export const dynamic = 'force-dynamic';

type SearchParamValue = string | string[] | undefined;

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const locales = ['en', 'vi'] as const;
  try {
    const res = await apiClient.get<PaginatedResponse<CollectionDto>>(API_ROUTES.CATALOG.COLLECTIONS, {
      params: { isActive: true, limit: 100 },
      next: { revalidate: 3600 },
    });
    const items = Array.isArray(res) ? res : (res?.data ?? []);
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
  const filters          = parseSearchParams(sp);

  const emptyPage: PaginatedResponse<ProductListItemDto> = {
    success:    true,
    data:       [],
    pagination: { page: 1, limit: 24, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    meta:       { timestamp: '', requestId: '' },
  };

  const localeHeaders = { 'X-Locale': locale };
  const [collectionRes, productsRes] = await Promise.allSettled([
    apiClient.get<CollectionDto>(API_ROUTES.CATALOG.COLLECTION(slug), {
      next: { revalidate: 300 },
      headers: localeHeaders,
    }),
    apiClient.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.PRODUCTS.LIST, {
      params: {
        collectionSlug: slug,
        page:           filters.page,
        limit:          24,
        sort:           filters.sort,
        isActive:       true,
      },
      next: { revalidate: 60 },
      headers: localeHeaders,
    }),
  ]);

  if (collectionRes.status === 'rejected' || !collectionRes.value) notFound();
  const collection = collectionRes.value;

  // A failed product fetch renders the collection as if it were empty, which
  // looks identical to a genuinely empty collection. Log it so the difference
  // is visible in `docker compose logs client`.
  warnIfRejected('collection:products', API_ROUTES.PRODUCTS.LIST, productsRes);

  const products   = productsRes.status === 'fulfilled' ? productsRes.value.data : [];
  const pagination = productsRes.status === 'fulfilled'
    ? productsRes.value.pagination
    : emptyPage.pagination;

  // Related collections — non-critical, falls back to null.
  // Same silent-swallow class as the allSettled branches above, just via
  // .catch(): the section below is gated on this being non-empty, so a broken
  // endpoint makes it disappear with nothing logged. Keep the fallback, log
  // the reason.
  const relatedRes = await apiClient
    .get<PaginatedResponse<CollectionDto>>(API_ROUTES.CATALOG.COLLECTIONS, {
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
        productCount={pagination.total}
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
        className="max-w-[1440px] mx-auto px-4 md:px-8 pt-4 pb-0"
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

      <ProductListingLayout
        locale={locale}
        title={collection.name}
        subtitle={collection.description}
        products={products}
        totalCount={pagination.total}
        totalPages={pagination.totalPages}
        currentFilters={filters}
        categories={[]}
        tags={[]}
      />

      {relatedRes && relatedRes.data.length > 0 && (
        <RelatedCollections
          collections={relatedRes.data.filter((c) => c.slug !== slug)}
          currentSlug={slug}
          locale={locale}
        />
      )}
    </>
  );
}
