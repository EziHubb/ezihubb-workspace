import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@mlh/api-client';
import type { CollectionDto, ProductListItemDto } from '@mlh/types';
import type { PaginatedResponse } from '@mlh/types';
import { ProductListingLayout } from '../../../../../components/listing/ProductListingLayout';
import { CollectionHero } from '../../../../../components/collections/CollectionHero';
import { RelatedCollections } from '../../../../../components/collections/RelatedCollections';
import { parseSearchParams } from '../../../../../components/listing/types';

export const dynamic = 'force-dynamic';

type SearchParamValue = string | string[] | undefined;

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const locales = ['en', 'vi'] as const;
  try {
    const res = await apiClient.get<PaginatedResponse<CollectionDto>>('/collections', {
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
  const { slug } = await params;

  const collection = await apiClient
    .get<CollectionDto>(`/collections/${slug}`, {
      next: { revalidate: 300 },
    })
    .catch(() => null);

  if (!collection) return { title: 'Collection Not Found' };

  return {
    title:       `${collection.name} | Maple Handmade`,
    description: collection.description ??
      `Explore our ${collection.name} collection of personalized handmade gifts.`,
    openGraph: {
      title:  `${collection.name} | Maple Handmade`,
      images: collection.bannerUrl ? [collection.bannerUrl] : [],
    },
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

  const [collectionRes, productsRes] = await Promise.allSettled([
    apiClient.get<CollectionDto>(`/collections/${slug}`, {
      next: { revalidate: 300 },
    }),
    apiClient.get<PaginatedResponse<ProductListItemDto>>('/products', {
      params: {
        collectionSlug: slug,
        page:           filters.page,
        limit:          24,
        sort:           filters.sort,
        isActive:       true,
      },
      next: { revalidate: 60 },
    }),
  ]);

  if (collectionRes.status === 'rejected' || !collectionRes.value) notFound();
  const collection = collectionRes.value;

  const products   = productsRes.status === 'fulfilled' ? productsRes.value.data : [];
  const pagination = productsRes.status === 'fulfilled'
    ? productsRes.value.pagination
    : emptyPage.pagination;

  // Related collections — non-critical, falls back to null
  const relatedRes = await apiClient
    .get<PaginatedResponse<CollectionDto>>('/collections', {
      params: { isActive: true, limit: 4, exclude: slug },
      next: { revalidate: 600 },
    })
    .catch(() => null);

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
