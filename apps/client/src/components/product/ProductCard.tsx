'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { RatingStars } from '@mlh/ui';
import { API_ROUTES } from '@mlh/constants';

type BadgeType = 'new' | 'sale' | 'hot' | 'bestseller';

interface ProductCardProps {
  slug: string;
  locale: string;
  image: string;
  name: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  reviewCount?: number;
  badge?: BadgeType;
  lowStock?: boolean;
  labelPersonalize?: string;
  labelLowStock?: string;
  className?: string;
  productId?: string;
  initialWishlisted?: boolean;
}

const badgeClasses: Record<BadgeType, string> = {
  new: 'bg-badge-new text-white',
  sale: 'bg-badge-sale text-white',
  hot: 'bg-badge-hot text-white',
  bestseller: 'bg-warning text-white',
};

export function ProductCard({
  slug,
  locale,
  image,
  name,
  price,
  originalPrice,
  rating = 5,
  reviewCount = 0,
  badge,
  lowStock = false,
  labelPersonalize = 'Personalize Now',
  labelLowStock = 'Low stock',
  className = '',
  productId,
  initialWishlisted = false,
}: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const productHref = `/${locale}/products/${slug}`;

  const handleWishlistToggle = async () => {
    if (!productId || isTogglingWishlist) return;
    setIsTogglingWishlist(true);
    try {
      const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';
      const method = isWishlisted ? 'DELETE' : 'POST';
      const res = await fetch(`${apiBase}${API_ROUTES.USERS.WISHLIST_ITEM(productId)}`, {
        method,
        credentials: 'include',
      });
      if (res.ok) setIsWishlisted((prev) => !prev);
    } catch {
      // Network errors silently ignored — wishlist is non-critical
    } finally {
      setIsTogglingWishlist(false);
    }
  };

  return (
    <div
      className={`bg-surface border border-border rounded-card p-4 hover:border-primary hover:shadow-card-hover transition-all duration-200 relative group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {badge && (
        <span className={`absolute top-2 left-2 z-10 rounded-pill px-3 py-1 text-xs uppercase font-semibold tracking-wide ${badgeClasses[badge]}`}>
          {badge}
        </span>
      )}

      <button
        onClick={handleWishlistToggle}
        disabled={isTogglingWishlist}
        className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors disabled:opacity-60"
        aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart className={`w-5 h-5 transition-colors ${isWishlisted ? 'fill-error text-error' : 'text-muted-foreground'}`} />
      </button>

      <Link href={productHref}>
        <div className="aspect-square mb-4 overflow-hidden rounded-lg bg-muted relative">
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
        <span className="text-primary font-semibold text-lg">${price.toFixed(2)}</span>
        {originalPrice && (
          <span className="text-muted-foreground line-through text-sm">${originalPrice.toFixed(2)}</span>
        )}
      </div>

      <RatingStars rating={rating} reviewCount={reviewCount} />

      {lowStock && (
        <p className="text-xs text-error font-medium mt-2">⚠ {labelLowStock}</p>
      )}

      {isHovered && (
        <Link
          href={productHref}
          className="mt-3 block w-full bg-primary hover:bg-primary-dark text-white font-semibold text-sm uppercase tracking-wide rounded-button py-3 transition-all duration-200 text-center"
        >
          {labelPersonalize}
        </Link>
      )}
    </div>
  );
}
