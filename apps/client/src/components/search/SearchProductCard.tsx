'use client';

import { useState, useEffect } from 'react';
import { Heart, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { ProductListItemDto } from '@mlh/types';
import { useWishlist, useMutateWishlist } from '@mlh/api-client';
import { useCartStore } from '../../lib/store/cart.store';
import { useAuthStore } from '../../lib/store/auth.store';

// ── Badge logic ───────────────────────────────────────────────────────────────

function getProductBadge(product: ProductListItemDto) {
  if ((product.soldCount24h ?? 0) >= 10) {
    return {
      label: `In ${product.soldCount24h}+ carts`,
      style: 'bg-[#FFF0EC] text-primary',
    };
  }
  if (product.soldCount > 1000 || product.badge === 'bestseller') {
    return { label: 'Bestseller', style: 'bg-yellow-100 text-yellow-800' };
  }
  if (product.compareAtPrice || product.badge === 'sale') {
    return { label: 'Sale', style: 'bg-green-100 text-green-700' };
  }
  if (product.isFeatured || product.badge === 'hot') {
    return { label: "Editor's pick", style: 'bg-purple-100 text-purple-700' };
  }
  if (product.badge === 'new') {
    return { label: 'New', style: 'bg-blue-100 text-blue-700' };
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  product: ProductListItemDto;
  priority?: boolean;
}

export function SearchProductCard({ product, priority = false }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const { addItem, isLoading: cartLoading } = useCartStore();
  const isLoggedIn = Boolean(useAuthStore((s) => s.user));
  const { data: wishlistData } = useWishlist(isLoggedIn);
  const { addToWishlist, removeFromWishlist } = useMutateWishlist();

  const isInWishlist = wishlistData?.some((w) => w.productId === product.id) ?? false;

  // Cycle through up to 4 images while hovering
  useEffect(() => {
    if (!isHovered || product.images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveImageIndex((i) => (i + 1) % Math.min(product.images.length, 4));
    }, 1200);
    return () => clearInterval(timer);
  }, [isHovered, product.images.length]);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setActiveImageIndex(0);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/${locale}/login?redirect=${redirect}`);
      return;
    }
    if (isInWishlist) {
      removeFromWishlist.mutate(product.id);
    } else {
      addToWishlist.mutate(product.id);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ productId: product.id, quantity: 1 });
  };

  const handleMoreLikeThis = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/${locale}/search?similar=${product.id}`);
  };

  const activeImage =
    product.images[activeImageIndex]?.url ?? product.images[0]?.url ?? '';
  const badge = getProductBadge(product);
  const avg = product.rating?.avg ?? 0;
  const ratingCount = product.rating?.count ?? 0;
  const discount =
    product.compareAtPrice
      ? Math.round((1 - Number(product.basePrice) / Number(product.compareAtPrice)) * 100)
      : 0;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* IMAGE CONTAINER */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#F5F1EB] mb-2.5">
        <Link href={`/${locale}/products/${product.slug}`}>
          <img
            src={activeImage}
            alt={product.name}
            loading={priority ? 'eager' : 'lazy'}
            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
          />
        </Link>

        {/* Image dot indicators */}
        {product.images.length > 1 && isHovered && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
            {product.images.slice(0, 4).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === activeImageIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* Wishlist button */}
        <button
          type="button"
          onClick={handleWishlistClick}
          aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          className={[
            'absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm',
            isHovered || isInWishlist ? 'opacity-100' : 'opacity-0',
            isInWishlist ? 'bg-white' : 'bg-white/80 hover:bg-white',
          ].join(' ')}
        >
          <Heart
            className={`w-4 h-4 transition-colors ${isInWishlist ? 'text-red-500' : 'text-secondary'}`}
            fill={isInWishlist ? 'currentColor' : 'none'}
          />
        </button>

        {/* Product badge */}
        {badge && (
          <div
            className={`absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-full text-xs font-medium ${badge.style}`}
          >
            {badge.label}
          </div>
        )}

        {/* Hover action row */}
        <div
          className={[
            'absolute bottom-0 left-0 right-0 z-10 p-2.5 flex gap-2 transition-all duration-200',
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          ].join(' ')}
        >
          {!product.isPersonalizable ? (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={cartLoading}
              className="flex-1 bg-white rounded-full py-1.5 text-xs font-medium text-secondary hover:bg-primary hover:text-white transition-colors shadow-sm text-center disabled:opacity-50"
            >
              Add to cart
            </button>
          ) : (
            <Link
              href={`/${locale}/products/${product.slug}`}
              className="flex-1 bg-white rounded-full py-1.5 text-xs font-medium text-secondary hover:bg-primary hover:text-white transition-colors shadow-sm text-center"
            >
              Personalize
            </Link>
          )}

          <button
            type="button"
            onClick={handleMoreLikeThis}
            title="More like this"
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-secondary hover:bg-primary hover:text-white transition-colors shadow-sm flex-shrink-0 text-xs font-bold"
          >
            ···
          </button>
        </div>
      </div>

      {/* CARD INFO */}
      <div className="space-y-0.5 px-0.5">
        <p className="text-xs text-muted truncate">MapleLoomHandmade</p>

        <Link href={`/${locale}/products/${product.slug}`}>
          <p className="text-sm text-secondary line-clamp-2 leading-snug hover:underline hover:text-primary transition-colors">
            {product.name}
          </p>
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-secondary">
            ${Number(product.basePrice).toFixed(2)}
          </span>
          {product.compareAtPrice && (
            <>
              <span className="text-xs text-muted line-through">
                ${Number(product.compareAtPrice).toFixed(2)}
              </span>
              <span className="text-xs text-green-700 font-medium">
                ({discount}% off)
              </span>
            </>
          )}
        </div>

        {/* Rating */}
        {ratingCount > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="w-2.5 h-2.5"
                  fill={s <= Math.round(avg) ? '#FBBF24' : 'transparent'}
                  color={s <= Math.round(avg) ? '#FBBF24' : '#E5E7EB'}
                />
              ))}
            </div>
            <span className="text-xs text-muted">
              ({ratingCount.toLocaleString()})
            </span>
          </div>
        )}

        <p className="text-xs text-muted">Free shipping</p>
      </div>
    </div>
  );
}
