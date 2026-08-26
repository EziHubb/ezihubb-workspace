'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PackageOpen } from 'lucide-react';
import { ProductCard, ProductCardSkeleton } from '@ezihubb/ui';
import { useWishlist, useWishlistToggle } from '@ezihubb/api-client';
import { useAuthStore } from '../../lib/store/auth.store';
import { useProductCardLabels } from '../../lib/hooks/useProductCardLabels';
import type { ProductListItemDto } from '@ezihubb/types';
import { deriveProductBadge } from '../../lib/product-badge';

interface ProductGridProps {
  products:   ProductListItemDto[];
  locale:     string;
  isLoading?: boolean;
}

export function ProductGrid({ products, locale, isLoading = false }: ProductGridProps) {
  const t               = useTranslations('search');
  const { locale: cardLocale, labels: cardLabels, badgeLabels } = useProductCardLabels();
  const router         = useRouter();
  const pathname       = usePathname();
  const isLoggedIn     = Boolean(useAuthStore((s) => s.user));
  const isAuthReady    = useAuthStore((s) => s.isAuthReady);
  const { data: wishlistData } = useWishlist(isAuthReady && isLoggedIn);
  const wishlistToggle = useWishlistToggle();
  const wishlistedIds  = new Set((wishlistData ?? []).map((w) => w.productId));

  const handleWishlistToggle = (productId: string) => {
    if (!isLoggedIn) {
      const redirect = encodeURIComponent(`${pathname}${window.location.search}`);
      router.push(`/${locale}/login?redirect=${redirect}`);
      return;
    }
    wishlistToggle(productId, wishlistedIds.has(productId));
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 24 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center col-span-full">
        <PackageOpen className="w-16 h-16 text-border mb-4" aria-hidden />
        <h3 className="font-display text-xl font-bold text-secondary mb-2">
          {t('noProductsFound')}
        </h3>
        <p className="text-muted mb-6 max-w-xs text-sm">
          {t('tryAdjustingFilters')}
        </p>
        <Link
          href={`/${locale}/search`}
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          {t('clearFilters')}
        </Link>
      </div>
    );
  }

  // ── Grid ───────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((product) => {
        const hasPriceRange =
          product.minPrice != null && product.maxPrice != null && product.minPrice !== product.maxPrice;
        return (
        <ProductCard
          key={product.id}
          id={product.id}
          slug={product.slug}
          name={product.name}
          imageUrl={
            product.primaryImage ?? 'https://placehold.co/400x500.png?text=No+Image'
          }
          basePrice={product.minPrice ?? product.basePrice}
          compareAtPrice={product.compareAtPrice ?? undefined}
          sale={product.sale ?? null}
          isPriceRange={hasPriceRange}
          rating={product.averageRating ?? undefined}
          reviewCount={product.reviewCount}
          badge={deriveProductBadge(product)}
          badgeLabel={(() => { const b = deriveProductBadge(product); return b ? badgeLabels[b] : undefined; })()}
          isPersonalizable={product.isPersonalizable}
          isDigital={product.productType === 'DIGITAL'}
          isWishlisted={wishlistedIds.has(product.id)}
          onWishlistToggle={handleWishlistToggle}
          storeName={product.store?.name}
          storeSlug={product.store?.slug}
          locale={cardLocale}
          basePath={`/${locale}`}
          labels={cardLabels}
        />
        );
      })}
    </div>
  );
}
