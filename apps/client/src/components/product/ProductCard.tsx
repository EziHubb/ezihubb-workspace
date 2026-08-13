'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { RatingStars } from '@ezihubb/ui';
import { API_ROUTES } from '@ezihubb/constants';
import { apiClient } from '../../lib/api-client';
import { useCurrency } from '../../lib/currency/currency-context';

type BadgeType = 'new' | 'sale' | 'hot' | 'bestseller';

interface ProductCardProps {
  slug:              string;
  locale:            string;
  image:             string;
  name:              string;
  price:             number;
  originalPrice?:    number;
  rating?:           number;
  reviewCount?:      number;
  badge?:            BadgeType;
  lowStock?:         boolean;
  labelPersonalize?: string;
  labelLowStock?:    string;
  className?:        string;
  productId?:        string;
  initialWishlisted?: boolean;
}

const badgeClasses: Record<BadgeType, string> = {
  new:        'bg-badge-new text-white',
  sale:       'bg-badge-sale text-white',
  hot:        'bg-badge-hot text-white',
  bestseller: 'bg-warning text-white',
};

export function ProductCard({
  slug,
  locale,
  image,
  name,
  price,
  originalPrice,
  rating,
  reviewCount      = 0,
  badge,
  lowStock         = false,
  labelPersonalize,
  labelLowStock,
  className        = '',
  productId,
  initialWishlisted = false,
}: ProductCardProps) {
  const t = useTranslations('product.actions');
  const tCommon = useTranslations('common');
  const tBadge = useTranslations('search.badge');
  const badgeLabels: Record<BadgeType, string> = {
    new:        tBadge('new'),
    sale:       tBadge('sale'),
    hot:        tBadge('editorsPick'),
    bestseller: tBadge('bestseller'),
  };
  const resolvedLabelPersonalize = labelPersonalize ?? t('personalize');
  const resolvedLabelLowStock = labelLowStock ?? tCommon('lowStock');
  const [isWishlisted,       setIsWishlisted]       = useState(initialWishlisted);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);
  const { format } = useCurrency();
  const productHref = `/${locale}/products/${slug}`;

  const handleWishlistToggle = async () => {
    if (!productId || isTogglingWishlist) return;
    setIsTogglingWishlist(true);
    try {
      if (isWishlisted) {
        await apiClient.delete(API_ROUTES.USERS.WISHLIST_ITEM(productId));
      } else {
        await apiClient.post(API_ROUTES.USERS.WISHLIST_ITEM(productId));
      }
      setIsWishlisted((prev) => !prev);
    } catch {
      // Network errors silently ignored — wishlist is non-critical
    } finally {
      setIsTogglingWishlist(false);
    }
  };

  return (
    // role="article" + aria-label improves screen-reader navigation of product grids
    <article
      aria-label={name}
      className={`bg-surface border border-border rounded-card p-4 hover:border-primary hover:shadow-card-hover transition-all duration-200 relative group ${className}`}
    >
      {badge && (
        <span
          className={`absolute top-2 left-2 z-10 rounded-pill px-3 py-1 text-xs uppercase font-semibold tracking-wide ${badgeClasses[badge]}`}
        >
          {badgeLabels[badge]}
        </span>
      )}

      {/* aria-busy signals async state to screen readers; aria-pressed tracks toggle */}
      <button
        type="button"
        onClick={handleWishlistToggle}
        disabled={isTogglingWishlist}
        aria-label={isWishlisted ? tCommon('removeFromWishlist') : tCommon('addToWishlist')}
        aria-pressed={isWishlisted}
        aria-busy={isTogglingWishlist || undefined}
        className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors disabled:opacity-60"
      >
        <Heart
          className={`w-5 h-5 transition-colors ${
            isWishlisted ? 'fill-error text-error' : 'text-muted'
          }`}
          aria-hidden="true"
        />
      </button>

      {/* prefetch={false} — product grids can contain 24+ cards; prefetching all wastes bandwidth */}
      <Link href={productHref} prefetch={false}>
        <div className="aspect-square mb-4 overflow-hidden rounded-lg bg-background relative">
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        </div>
        <h4 className="font-semibold text-lg mb-2 line-clamp-2 text-secondary">{name}</h4>
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary font-semibold text-lg">
          {format(price)}
        </span>
        {originalPrice && (
          <span className="text-muted line-through text-sm">
            {format(originalPrice)}
          </span>
        )}
      </div>

      {rating !== undefined && (
        <RatingStars
          rating={rating}
          reviewCount={reviewCount}
          starAriaLabel={(value) => tCommon('starAriaLabel', { value })}
        />
      )}

      {lowStock && (
        <p className="text-xs text-error font-medium mt-2" role="status">
          ⚠ {resolvedLabelLowStock}
        </p>
      )}

      {/*
        CTA rendered via CSS group-hover instead of React state (isHovered).
        Avoids a re-render on every mousemove event across the grid.
        hidden → group-hover:block is pure CSS, zero JS overhead.
        tabIndex={-1} / aria-hidden: navigable via the main Link above.
      */}
      <Link
        href={productHref}
        prefetch={false}
        tabIndex={-1}
        aria-hidden="true"
        className="mt-3 hidden group-hover:block w-full bg-primary hover:bg-primary-dark text-white font-semibold text-sm uppercase tracking-wide rounded-button py-3 transition-colors text-center"
      >
        {resolvedLabelPersonalize}
      </Link>
    </article>
  );
}
