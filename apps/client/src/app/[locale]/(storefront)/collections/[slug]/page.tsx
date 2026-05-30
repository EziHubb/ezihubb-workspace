import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { CollectionDto, ProductListItemDto, TagDto } from '@mlh/types';
import { ProductListingLayout } from '../../../../../components/listing/ProductListingLayout';
import {
  parseSearchParams,
  buildProductsApiUrl,
  fetchPaged,
  fetchOne,
  fetchList,
} from '../../../../../components/listing/types';

export const revalidate = 30;

type SearchParamValue = string | string[] | undefined;

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
  try {
    const res = await fetch(`${base}/api/v1/catalog/collections`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: CollectionDto[] };
    return (body.data ?? []).map((c) => ({ slug: c.slug }));
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

  const collection = await fetchOne<CollectionDto>(
    `${base}/api/v1/catalog/collections/${slug}`,
  );

  if (!collection) return { title: 'Collection Not Found' };

  return {
    title:       `${collection.name} | Maple Loom Handmade`,
    description: collection.description ??
      `Explore our ${collection.name} collection of personalized handmade gifts.`,
    openGraph: {
      title:  `${collection.name} | Maple Loom Handmade`,
      images: collection.imageUrl ? [collection.imageUrl] : [],
    },
  };
}

// ── Collection hero banner ────────────────────────────────────────────────────

function CollectionHero({
  collection,
}: {
  collection: CollectionDto;
}) {
  return (
    <div className="relative h-52 md:h-72 lg:h-80 overflow-hidden bg-secondary">
      {collection.imageUrl && (
        <Image
          src={collection.imageUrl}
          alt={collection.name}
          fill
          sizes="100vw"
          className="object-cover opacity-80"
          priority
        />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      <div className="absolute inset-0 flex items-end">
        <div className="max-w-[1440px] w-full mx-auto px-4 md:px-8 pb-8">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 leading-tight">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="text-white/80 text-base md:text-lg max-w-xl leading-relaxed">
              {collection.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Related collections strip ─────────────────────────────────────────────────

function RelatedCollections({
  collections,
  locale,
  currentSlug,
}: {
  collections: CollectionDto[];
  locale:      string;
  currentSlug: string;
}) {
  const related = collections
    .filter((c) => c.isActive && c.slug !== currentSlug)
    .slice(0, 4);

  if (related.length === 0) return null;

  return (
    <section className="bg-surface border-t border-border py-12 md:py-16 mt-4">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <h2 className="font-display text-2xl font-bold text-secondary mb-6">
          More Collections
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {related.map((col) => (
            <Link
              key={col.id}
              href={`/${locale}/collections/${col.slug}`}
              className="group relative overflow-hidden rounded-card aspect-[4/3] bg-muted block"
            >
              {col.imageUrl ? (
                <Image
                  src={col.imageUrl}
                  alt={col.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent group-hover:from-black/75 transition-colors duration-300" />
              <div className="absolute inset-0 flex items-end p-3 md:p-4">
                <p className="font-display text-white font-bold text-sm md:text-base leading-tight">
                  {col.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
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

  const [collection, productsResult, allCollections, tags] = await Promise.all([
    fetchOne<CollectionDto>(`${base}/api/v1/catalog/collections/${slug}`),
    fetchPaged<ProductListItemDto>(
      buildProductsApiUrl(base, filters, { collectionSlug: slug }),
    ),
    fetchList<CollectionDto>(
      `${base}/api/v1/catalog/collections?isActive=true&limit=20`,
    ),
    fetchList<TagDto>(`${base}/api/v1/catalog/tags`),
  ]);

  if (!collection) notFound();

  // Urgency strip: show when collection has an endDate within 7 days.
  // CollectionDto currently lacks an endDate field — pending API update.
  // This block is ready for when the field is added.
  const urgencyDays: number | null = null; // placeholder

  return (
    <>
      {/* Hero banner */}
      <CollectionHero collection={collection} />

      {/* Urgency strip — shown when endDate is within 7 days */}
      {urgencyDays !== null && urgencyDays <= 7 && (
        <div className="bg-warning/10 border-b border-warning/30 py-2.5 px-4 text-center">
          <p className="text-sm font-medium text-warning flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4" />
            This collection ends in{' '}
            <strong>{urgencyDays} day{urgencyDays !== 1 ? 's' : ''}</strong>
            {' '}— order soon!
          </p>
        </div>
      )}

      {/* Product listing */}
      <ProductListingLayout
        locale={locale}
        title={collection.name}
        subtitle={collection.description}
        products={productsResult.data}
        totalCount={productsResult.total}
        totalPages={productsResult.totalPages}
        currentFilters={filters}
        categories={[]}   // Collection pages don't filter by category
        tags={tags}
      />

      {/* Related collections strip */}
      <RelatedCollections
        collections={allCollections}
        locale={locale}
        currentSlug={slug}
      />
    </>
  );
}
