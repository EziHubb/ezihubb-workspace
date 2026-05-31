import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { CollectionDto, ProductListItemDto, TagDto } from '@mlh/types';
import { ProductListingLayout } from '../../../../../components/listing/ProductListingLayout';
import { CollectionHero } from '../../../../../components/collections/CollectionHero';
import { RelatedCollections } from '../../../../../components/collections/RelatedCollections';
import {
  parseSearchParams,
  buildProductsApiUrl,
  fetchPaged,
  fetchOne,
  fetchList,
} from '../../../../../components/listing/types';

export const revalidate = 60;

type SearchParamValue = string | string[] | undefined;

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const base    = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
  const locales = ['en', 'vi'] as const;
  try {
    const res = await fetch(`${base}/api/v1/catalog/collections?isActive=true`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: { slug: string }[] };
    const slugs = (body.data ?? []).map((c) => c.slug);
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
  const base     = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const collection = await fetchOne<CollectionDto & { endDate?: string; bannerUrl?: string }>(
    `${base}/api/v1/catalog/collections/${slug}`,
  );

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
  const base             = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  // CollectionDto extended with API fields not yet in types
  type CollectionWithDates = CollectionDto & { endDate?: string; startDate?: string; bannerUrl?: string };

  const [collection, productsResult, allCollections, tags] = await Promise.all([
    fetchOne<CollectionWithDates>(`${base}/api/v1/catalog/collections/${slug}`),
    fetchPaged<ProductListItemDto>(
      buildProductsApiUrl(base, filters, { collection: slug }),
    ),
    fetchList<CollectionDto>(`${base}/api/v1/catalog/collections?isActive=true`),
    fetchList<TagDto>(`${base}/api/v1/catalog/tags`),
  ]);

  if (!collection) notFound();

  // Urgency: show if endDate exists and is within 7 days
  let urgencyDays: number | null = null;
  if (collection.endDate) {
    const msLeft = new Date(collection.endDate).getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft <= 7) {
      urgencyDays = daysLeft;
    }
  }

  // Urgency date formatted for display
  const urgencyDate = collection.endDate
    ? new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        month: 'long',
        day:   'numeric',
      }).format(new Date(collection.endDate))
    : null;

  return (
    <>
      {/* Full-bleed hero */}
      <CollectionHero
        collection={collection as CollectionDto & { bannerUrl?: string }}
        productCount={productsResult.total}
      />

      {/* Urgency strip — only when endDate is within 7 days */}
      {urgencyDays !== null && urgencyDate && (
        <div className="bg-amber-50 border-b border-amber-200 py-2.5 text-center">
          <p className="text-sm font-medium text-amber-800">
            ⏰ This collection ends {urgencyDate} — shop before it&apos;s gone!
          </p>
        </div>
      )}

      {/* Breadcrumb */}
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

      {/* Product listing with filters */}
      <ProductListingLayout
        locale={locale}
        title={collection.name}
        subtitle={collection.description}
        products={productsResult.data}
        totalCount={productsResult.total}
        totalPages={productsResult.totalPages}
        currentFilters={filters}
        categories={[]}
        tags={tags}
      />

      {/* Related collections */}
      <RelatedCollections
        collections={allCollections}
        currentSlug={slug}
        locale={locale}
      />
    </>
  );
}
