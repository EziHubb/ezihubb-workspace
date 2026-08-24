import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import type { ProductListItemDto } from '@ezihubb/types';
import { ProductCard } from '@ezihubb/ui';
import type { ProductBadgeVariant, ProductCardLabels } from '@ezihubb/ui';
import { BackButton } from './BackButton';
import { API_BASE } from '../../lib/api-client';
import { deriveProductBadge } from '../../lib/product-badge';

// A 404-status response indexable by default (inherited from the locale
// layout) confused Search Console into pairing this thin fallback content
// with whatever canonical the layout happened to declare — explicitly
// noindex every not-found render instead.
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: true } };
}

// ── Fetch trending products server-side ───────────────────────────────────────

async function getTrending(): Promise<ProductListItemDto[]> {
  try {
    const res  = await fetch(
      `${API_BASE}/api/v1/products?sort=bestseller&limit=4`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const body = await res.json();
    return (body.data ?? []) as ProductListItemDto[];
  } catch {
    return [];
  }
}

// ── Magnifying glass 404 illustration ────────────────────────────────────────

function Illustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="mx-auto text-muted/20"
    >
      <circle cx="52" cy="52" r="40" stroke="currentColor" strokeWidth="6" />
      <line x1="82" y1="82" x2="108" y2="108" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <line x1="38" y1="38" x2="66" y2="66" stroke="#E85D3F" strokeWidth="5" strokeLinecap="round" />
      <line x1="66" y1="38" x2="38" y2="66" stroke="#E85D3F" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function NotFound() {
  const [trending, t, tCommon, tActions, tBadge, tSearch, locale] = await Promise.all([
    getTrending(),
    getTranslations('errors'),
    getTranslations('common'),
    getTranslations('product.actions'),
    getTranslations('search.badge'),
    getTranslations('search'),
    getLocale(),
  ]);

  const cardLabels: ProductCardLabels = {
    addToWishlist:      tCommon('addToWishlist'),
    removeFromWishlist: tCommon('removeFromWishlist'),
    personalizeNow:     tActions('personalize'),
    addToCart:          tActions('addToCart'),
    // .raw() so this stays a plain string: ProductCard substitutes {name}.
    // A closure here cannot cross the Server -> Client boundary.
    byStore:            tCommon.raw('byStore') as string,
    digitalDownload:    tSearch('digitalDownload'),
  };

  const badgeLabels: Record<ProductBadgeVariant, string> = {
    bestseller: tBadge('bestseller'),
    new:        tBadge('new'),
    sale:       tBadge('sale'),
    hot:        tBadge('editorsPick'),
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
      <div className="text-center mb-12">
        <p className="font-display text-8xl md:text-9xl font-bold text-primary/20 leading-none mb-4">
          404
        </p>

        <Illustration />

        <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mt-6 mb-3">
          {t('pageNotFoundTitle')}
        </h1>
        <p className="text-muted text-base max-w-md mx-auto mb-8">
          {t('pageNotFoundDesc')}
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <BackButton />
          <Link
            href={`/${locale}`}
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
          >
            {tCommon('goHome')}
          </Link>
        </div>

        {/* Search */}
        <div className="max-w-sm mx-auto">
          <form action={`/${locale}/search`} method="GET">
            <div className="flex gap-2">
              <input
                name="q"
                type="search"
                placeholder={t('searchPlaceholder')}
                className="flex-1 px-3 py-2.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary-dark transition-colors"
              >
                {tCommon('search')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Trending products */}
      {trending.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-bold text-secondary mb-6 text-center">
            {t('trendingRightNow')}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {trending.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                imageUrl={
                  product.images?.[0]?.url ??
                  'https://placehold.co/400x500.png?text=No+Image'
                }
                basePrice={product.basePrice}
                compareAtPrice={product.compareAtPrice ?? undefined}
                rating={product.averageRating ?? undefined}
                reviewCount={product.reviewCount}
                badge={deriveProductBadge(product)}
                badgeLabel={(() => { const b = deriveProductBadge(product); return b ? badgeLabels[b] : undefined; })()}
                isPersonalizable={product.isPersonalizable}
                isDigital={product.productType === 'DIGITAL'}
                locale={locale}
                basePath={`/${locale}`}
                labels={cardLabels}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
