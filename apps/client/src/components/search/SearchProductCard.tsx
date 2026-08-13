'use client';

import { useState, useEffect } from 'react';
import { Heart, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { ProductListItemDto } from '@ezihubb/types';
import { useWishlist, useWishlistToggle } from '@ezihubb/api-client';
import { useCartStore } from '../../lib/store/cart.store';
import { useAuthStore } from '../../lib/store/auth.store';
import { fmtAmount, safeArr, safeNum } from '@ezihubb/utils';

// ── Badge logic ───────────────────────────────────────────────────────────────

type Translator = ReturnType<typeof useTranslations>;

function getProductBadge(t: Translator, product: ProductListItemDto) {
  if ((product.soldCount24h ?? 0) >= 10) {
    return {
      label: t('badge.inCarts', { count: product.soldCount24h ?? 0 }),
      style: 'bg-[#FFF0EC] text-primary',
    };
  }
  if (product.soldCount > 1000 || product.badge === 'bestseller') {
    return { label: t('badge.bestseller'), style: 'bg-yellow-100 text-yellow-800' };
  }
  if (product.compareAtPrice || product.badge === 'sale') {
    return { label: t('badge.sale'), style: 'bg-green-100 text-green-700' };
  }
  if (product.isFeatured || product.badge === 'hot') {
    return { label: t('badge.editorsPick'), style: 'bg-purple-100 text-purple-700' };
  }
  if (product.badge === 'new') {
    return { label: t('badge.new'), style: 'bg-blue-100 text-blue-700' };
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  product: ProductListItemDto;
  priority?: boolean;
  /** Active search query, if this card is rendered inside search results — carried
   * onto the product link as ?st= so a later purchase can be attributed to the
   * keyword that led here (see SearchAttributionTracker + marketplace-insights). */
  searchTerm?: string;
}

export function SearchProductCard({ product, priority = false, searchTerm }: Props) {
  const locale = useLocale();
  const productHref = `/${locale}/products/${product.slug}${
    searchTerm ? `?st=${encodeURIComponent(searchTerm)}` : ''
  }`;
  const t = useTranslations('search');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const { addItem, isLoading: cartLoading } = useCartStore();
  const isLoggedIn     = Boolean(useAuthStore((s) => s.user));
  const isAuthReady    = useAuthStore((s) => s.isAuthReady);
  const { data: wishlistData } = useWishlist(isAuthReady && isLoggedIn);
  const wishlistToggle = useWishlistToggle();

  const isInWishlist = wishlistData?.some((w) => w.productId === product.id) ?? false;

  // Cycle through up to 4 images while hovering
  useEffect(() => {
    if (!isHovered || safeArr(product.images).length <= 1) return;
    const timer = setInterval(() => {
      setActiveImageIndex((i) => (i + 1) % Math.min(safeArr(product.images).length, 4));
    }, 1200);
    return () => clearInterval(timer);
  }, [isHovered, safeArr(product.images).length]);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setActiveImageIndex(0);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/${locale}/login?redirect=${redirect}`);
      return;
    }
    wishlistToggle(product.id, isInWishlist);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ productId: product.id, quantity: 1 });
  };

  const activeImage =
    safeArr(product.images)[activeImageIndex]?.url ?? safeArr(product.images)[0]?.url ?? '';
  const badge = getProductBadge(t, product);
  const avg = product.averageRating ?? 0;
  const ratingCount = product.reviewCount ?? 0;
  // basePrice is seller-entered and never auto-synced to per-variant prices —
  // prefer the real minVariantPrice so a stale basePrice can't understate or
  // overstate what the cheapest option actually costs.
  const hasPriceRange = product.minPrice != null && product.maxPrice != null && product.minPrice !== product.maxPrice;
  const displayPrice = product.minPrice ?? product.basePrice;
  // Computed from displayPrice, not basePrice — when the product has
  // variants all priced the same (minPrice === maxPrice, so hasPriceRange is
  // false) but that shared price differs from the stale basePrice, using
  // basePrice here would show a "% off" badge that doesn't match the price
  // actually printed next to it.
  const discount =
    !hasPriceRange && product.compareAtPrice
      ? Math.round((1 - safeNum(displayPrice) / safeNum(product.compareAtPrice)) * 100)
      : 0;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* IMAGE CONTAINER */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#F5F1EB] mb-2.5">
        <Link href={productHref}>
          <img
            src={activeImage}
            alt={product.name}
            loading={priority ? 'eager' : 'lazy'}
            className="w-full h-full object-cover transition-all duration-500"
          />
        </Link>

        {/* Image dot indicators */}
        {safeArr(product.images).length > 1 && isHovered && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
            {safeArr(product.images).slice(0, 4).map((_, i) => (
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
          aria-label={isInWishlist ? tCommon('removeFromWishlist') : tCommon('addToWishlist')}
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
              {t('addToCart')}
            </button>
          ) : (
            <Link
              href={productHref}
              className="flex-1 bg-white rounded-full py-1.5 text-xs font-medium text-secondary hover:bg-primary hover:text-white transition-colors shadow-sm text-center"
            >
              {t('personalize')}
            </Link>
          )}

        </div>
      </div>

      {/* CARD INFO */}
      <div className="space-y-0.5 px-0.5">
        {product.store?.slug ? (
          <Link
            href={`/${locale}/shops/${product.store.slug}`}
            className="block text-xs text-muted hover:text-primary transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {product.store.name}
          </Link>
        ) : (
          <p className="text-xs text-muted truncate">{product.store?.name ?? 'EziHubb'}</p>
        )}

        <Link href={productHref}>
          <p className="text-sm text-secondary line-clamp-2 leading-snug hover:underline hover:text-primary transition-colors">
            {product.name}
          </p>
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-secondary">
            {hasPriceRange && <span className="font-normal text-muted">{t('fromPrice')} </span>}
            {fmtAmount(displayPrice)}
          </span>
          {!hasPriceRange && product.compareAtPrice && (
            <>
              <span className="text-xs text-muted line-through">
                {fmtAmount(product.compareAtPrice)}
              </span>
              <span className="text-xs text-green-700 font-medium">
                {t('percentOff', { percent: discount })}
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

        <p className="text-xs text-muted">{t('freeShipping')}</p>
      </div>
    </div>
  );
}
