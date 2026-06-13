'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { PackageOpen } from 'lucide-react';
import { ProductCard, ProductCardSkeleton } from '@mlh/ui';
import { useMutateWishlist } from '@mlh/api-client';
import type { ProductListItemDto } from '@mlh/types';

interface ProductGridProps {
  products:   ProductListItemDto[];
  locale:     string;
  isLoading?: boolean;
}

export function ProductGrid({ products, locale, isLoading = false }: ProductGridProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { addToWishlist, removeFromWishlist } = useMutateWishlist();

  /**
   * Toggle wishlist for a product.
   * If the user is not authenticated, redirect to /login first.
   */
  const handleWishlistToggle = (productId: string) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    if (!token) {
      const redirect = encodeURIComponent(`${pathname}${window.location.search}`);
      router.push(`/${locale}/login?redirect=${redirect}`);
      return;
    }

    // Note: We don't know the current wishlist state here without reading the
    // wishlist cache. For now, optimistically try to add; if the product is
    // already wishlisted the API will return a 409 which is silently ignored.
    addToWishlist.mutate(productId);
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
          No products found
        </h3>
        <p className="text-muted mb-6 max-w-xs text-sm">
          Try adjusting or clearing your filters.
        </p>
        <Link
          href={`/${locale}/search`}
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          Clear Filters
        </Link>
      </div>
    );
  }

  // ── Grid ───────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          slug={product.slug}
          name={product.name}
          imageUrl={
            product.primaryImage ?? 'https://placehold.co/400x500.png?text=No+Image'
          }
          basePrice={product.basePrice}
          compareAtPrice={product.compareAtPrice}
          rating={product.rating?.avg}
          reviewCount={product.rating?.count}
          badge={product.badge}
          isPersonalizable={product.isPersonalizable}
          onWishlistToggle={handleWishlistToggle}
          storeName={product.store?.name}
          storeSlug={product.store?.slug}
        />
      ))}
    </div>
  );
}
