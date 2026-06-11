'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge, type ProductBadgeVariant } from '../Badge/Badge';
import { RatingStars } from '../RatingStars/RatingStars';

export interface ProductCardProps {
  id:               string;
  slug:             string;
  name:             string;
  imageUrl:         string;
  basePrice:        number;
  compareAtPrice?:  number;
  rating?:          number;
  reviewCount?:     number;
  badge?:           ProductBadgeVariant;
  isPersonalizable?: boolean;
  isWishlisted?:    boolean;
  currency?:        string;
  onWishlistToggle?: (id: string) => void;
  onAddToCart?:     (id: string) => void;
  storeName?:       string | null;
  storeSlug?:       string | null;
}

function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  slug,
  name,
  imageUrl,
  basePrice,
  compareAtPrice,
  rating,
  reviewCount,
  badge,
  isPersonalizable = false,
  isWishlisted     = false,
  currency         = 'USD',
  onWishlistToggle,
  onAddToCart,
  storeName,
  storeSlug,
}) => {
  const [hovered, setHovered] = useState(false);
  const discount =
    compareAtPrice && compareAtPrice > basePrice
      ? Math.round((1 - basePrice / compareAtPrice) * 100)
      : 0;

  return (
    <article
      className="group relative rounded-card border border-border bg-surface overflow-hidden hover:shadow-card-hover transition-shadow duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Image ──────────────────────────────────────────────────────────── */}
      <Link href={`/products/${slug}`} className="block relative aspect-[4/5] bg-background overflow-hidden">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {badge && (
          <div className="absolute top-3 left-3">
            <Badge variant={badge} />
          </div>
        )}

        {onWishlistToggle && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onWishlistToggle(id); }}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className={[
              'absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm',
              'transition-colors duration-150',
              isWishlisted ? 'text-error' : 'text-muted hover:text-error',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        )}

        {/* CTA hover banner — text depends on personalizability */}
        <div
          className={[
            'absolute bottom-0 left-0 right-0 bg-primary/95 px-4 py-3',
            'transition-transform duration-300',
            hovered ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
        >
          <span className="block text-center text-white text-sm font-medium">
            {isPersonalizable ? 'Personalize Now' : 'Add to Cart'}
          </span>
        </div>
      </Link>

      {/* ── Info ───────────────────────────────────────────────────────────── */}
      <div className="p-4">
        <Link href={`/products/${slug}`}>
          <h3 className="text-sm font-medium text-secondary line-clamp-2 mb-1 hover:text-primary transition-colors">
            {name}
          </h3>
        </Link>
        {storeName && storeSlug && (
          <Link
            href={`/shops/${storeSlug}`}
            className="block text-xs text-muted hover:text-primary transition-colors mb-1 truncate"
            onClick={(e) => e.stopPropagation()}
          >
            By {storeName}
          </Link>
        )}

        {rating !== undefined && (
          <div className="mb-2">
            <RatingStars rating={rating} reviewCount={reviewCount} size="sm" />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-secondary">
            {formatPrice(basePrice, currency)}
          </span>
          {compareAtPrice && compareAtPrice > basePrice && (
            <>
              <span className="text-xs text-muted line-through">
                {formatPrice(compareAtPrice, currency)}
              </span>
              {discount > 0 && (
                <span className="text-xs font-medium text-error">-{discount}%</span>
              )}
            </>
          )}
        </div>

        {onAddToCart && (
          <button
            type="button"
            onClick={() => onAddToCart(id)}
            className="mt-3 w-full h-8 rounded-button border border-primary text-primary text-xs font-medium hover:bg-primary hover:text-white transition-colors duration-150"
          >
            Add to Cart
          </button>
        )}
      </div>
    </article>
  );
};
