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
import { STANDARD_COLORS } from './SearchFilterSidebar';
import { fmtAmount, fmtRating, safeArr, safeNum } from '@ezihubb/utils';

/**
 * Review counts the way the reference prints them: 5800 -> "5.8k".
 *
 * Locale-independent on purpose. This is a compact magnitude next to a star,
 * not a figure anyone reads precisely, and mixing thousands separators into a
 * three-character slot is what makes those lines wrap.
 */
function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  // 5800 -> 5.8k, but 12000 -> 12k rather than 12.0k
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

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
  // Computed from displayPrice, not basePrice: displayPrice is the figure
  // actually printed next to it, so the percentage always describes the price
  // the shopper can see. Using the seller-entered basePrice — which is never
  // re-synced to per-variant prices — would print a discount that does not
  // match the number beside it.
  //
  // Shown for range-priced listings too. The percentage then describes the
  // cheapest variant, the same one the "From $X" price refers to, so the two
  // numbers stay consistent with each other. Suppressing it on ranges, as
  // this used to, hid every discount on any product with variants — which is
  // most of them.
  const discount =
    product.compareAtPrice
      ? Math.round((1 - safeNum(displayPrice) / safeNum(product.compareAtPrice)) * 100)
      : 0;

  return (
    <div
      // flex column so the action row can sit last via `order-last`, keeping
      // it under the card text without moving the JSX away from the hover
      // state it belongs to.
      className="group relative flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* IMAGE CONTAINER */}
      {/* 4:5 portrait, measured off both references: 299x374 @1280 and
          410x512 @1920 — the same ratio at both widths. Was aspect-square. */}
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#F5F1EB] mb-2.5">
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

      </div>

      {/* ACTION ROW — rendered last, below the card text, never over the
          image. These used to be absolutely positioned inside the image
          container, so hovering covered the bottom of the product photo,
          which is the one thing the shopper is looking at. The row keeps a
          reserved height so the grid does not jump as the mouse crosses it. */}
      <div className="order-last mt-2 h-8">
        <div
          className={[
            'flex gap-2 transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none',
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

          {/* "More like this" — the reference pairs it with the primary
              action. Points at the existing search page filtered by this
              product's category rather than a per-product recommendation
              endpoint: /products/:slug/related exists but is a page-level
              fetch, and firing one request per card in a 48-item grid to
              populate a link is not worth it. */}
          <Link
            href={`/${locale}/search?category=${encodeURIComponent(product.categorySlug ?? '')}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white rounded-full py-1.5 text-xs font-medium text-secondary hover:bg-secondary hover:text-white transition-colors shadow-sm text-center"
          >
            {t('moreLikeThis')}
          </Link>

        </div>
      </div>

      {/* CARD INFO */}
      <div className="space-y-0.5 px-0.5">
        {/* Colour swatches — sits directly under the image, as in the
            reference. Purely informative: these are not filter controls, so
            they are not focusable and carry no click handler. The list is
            capped at 7 with a "+N" overflow so a product tagged with a dozen
            colours cannot push the title out of the card.
            Unknown colour names are dropped rather than rendered grey: a
            swatch showing the wrong colour is worse than a missing one. */}
        {(() => {
          const swatches = (product.primaryColors ?? [])
            .map((name) => STANDARD_COLORS.find((c) => c.name.toLowerCase() === name.toLowerCase()))
            .filter((c): c is (typeof STANDARD_COLORS)[number] => Boolean(c));
          if (swatches.length === 0) return null;
          const shown = swatches.slice(0, 7);
          const extra = swatches.length - shown.length;
          return (
            <div className="flex items-center gap-1 pb-0.5" aria-hidden="true">
              {shown.map((c) => (
                <span
                  key={c.name}
                  title={c.name}
                  className="w-3 h-3 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {extra > 0 && <span className="text-[10px] text-muted leading-none">+{extra}</span>}
            </div>
          );
        })()}

        {/* Title — ONE line, ellipsised. Measured off the 1280px reference:
            every card there is a single line, and a fixed line count is what
            keeps the row of cards aligned. Two lines let a long name push one
            card's price and buttons below its neighbours'. */}
        <Link href={productHref}>
          <p className="text-sm text-secondary truncate leading-snug hover:underline hover:text-primary transition-colors">
            {product.name}
          </p>
        </Link>

        {/* Rating and shop share ONE line, as in the reference: 4.8 ★ (329) By
            ShopName. They were on separate lines, which cost a whole row of
            height per card for two short fragments.
            Fixed height even when empty so cards with no reviews line up with
            cards that have them. */}
        <div className="flex items-center gap-1 h-4 text-xs text-muted min-w-0">
          {ratingCount > 0 && (
            <>
              <span className="font-semibold text-secondary tabular-nums">{fmtRating(avg)}</span>
              <Star className="w-2.5 h-2.5 shrink-0" fill="#FBBF24" color="#FBBF24" />
              <span className="shrink-0">({compactCount(ratingCount)})</span>
            </>
          )}
          {product.store?.slug ? (
            <Link
              href={`/${locale}/shops/${product.store.slug}`}
              className="truncate hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {t('byStore', { name: product.store.name })}
            </Link>
          ) : (
            product.store?.name && (
              <span className="truncate">{t('byStore', { name: product.store.name })}</span>
            )
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-secondary">
            {hasPriceRange && <span className="font-normal text-muted">{t('fromPrice')} </span>}
            {fmtAmount(displayPrice)}
          </span>
          {product.compareAtPrice && discount > 0 && (
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

        <p className="text-xs text-muted">{t('freeShipping')}</p>
      </div>
    </div>
  );
}
