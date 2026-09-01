'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { useCartStore } from '../../lib/store/cart.store';
import type { ProductListItemDto } from '@ezihubb/types';
import { fmtAmount, safeArr, safeNum } from '@ezihubb/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACEHOLDER = 'https://placehold.co/400x400/F5F1EB/999.png?text=No+Image';
const GRID_THRESHOLD = 12;

// ── MiniStars ─────────────────────────────────────────────────────────────────

function MiniStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const rounded = Math.round(rating);
  const cls     = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${
            s <= rounded
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ── RelatedProductCard ────────────────────────────────────────────────────────

function RelatedProductCard({
  product,
  locale,
}: {
  product: ProductListItemDto;
  locale:  string;
}) {
  const t          = useTranslations('product.pdp');
  const tPanel     = useTranslations('product.purchasePanel');
  const tSearch    = useTranslations('search');
  const addItem    = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const hasPriceRange = product.minPrice != null
    && product.maxPrice != null
    && product.minPrice !== product.maxPrice;
  const shownPrice = product.sale?.price ?? product.minPrice ?? product.basePrice;
  const struckPrice = product.sale?.originalPrice ?? null;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await addItem({ productId: product.id, variantId: null, quantity: 1 });
      openDrawer();
    } catch {
      // silent — user can navigate to the product page to add with options
    }
  };

  return (
    <div className="group relative">
      <Link href={`/${locale}/products/${product.slug}`}>

        {/* Image */}
        <div className="relative aspect-square rounded-xl overflow-hidden bg-[#F5F1EB] mb-2">
          <Image
            src={product.images?.[0]?.url ?? PLACEHOLDER}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Name */}
        <p className="text-xs text-secondary line-clamp-2 leading-snug">{product.name}</p>

        {/* Digital download label — Etsy shows this on every digital listing's card */}
        {product.productType === 'DIGITAL' && (
          <p className="text-[10px] text-muted mt-0.5">{tPanel('digitalDownload')}</p>
        )}

        {/* Price */}
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1">
          <p className={`text-sm font-bold ${product.sale ? 'text-badge-sale' : 'text-secondary'}`}>
            {hasPriceRange && <span className="font-normal text-muted">{tSearch('fromPrice')} </span>}
            {fmtAmount(shownPrice)}
          </p>
          {struckPrice != null && struckPrice > shownPrice && (
            <span className="text-[10px] text-muted line-through">{fmtAmount(struckPrice)}</span>
          )}
        </div>

        {/* Stars + count */}
        {product.reviewCount > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <MiniStars rating={product.averageRating ?? 0} size="xs" />
            <span className="text-[10px] text-muted ml-0.5">
              ({safeNum(product.reviewCount).toLocaleString(locale)})
            </span>
          </div>
        )}

        {/* Sales count */}
        {product.soldCount > 0 && (
          <p className="text-[10px] text-muted">
            {t('sales', { count: safeNum(product.soldCount).toLocaleString(locale) })}
          </p>
        )}
      </Link>

      {/* Quick-add on hover — only for non-personalizable products with no variants */}
      {!product.isPersonalizable && (
        <button
          type="button"
          onClick={handleQuickAdd}
          className="absolute bottom-8 left-1 right-1 bg-white border border-border rounded-full py-1.5 text-xs font-medium text-secondary opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-[#F3F4F6]"
        >
          {tSearch('addToCart')}
        </button>
      )}
    </div>
  );
}

// ── YouMayAlsoLike ────────────────────────────────────────────────────────────

interface YouMayAlsoLikeProps {
  products: ProductListItemDto[];
  locale:   string;
}

export function YouMayAlsoLike({ products, locale }: YouMayAlsoLikeProps) {
  const t = useTranslations('product.pdp');
  const [showAll, setShowAll] = useState(false);

  if (safeArr(products).length === 0) return null;

  const displayed = showAll ? safeArr(products) : safeArr(products).slice(0, GRID_THRESHOLD);

  return (
    <section className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-secondary">{t('youMayAlsoLike')}</h2>
          <p className="text-xs text-muted">{t('includingAds')}</p>
        </div>
        {safeArr(products).length > GRID_THRESHOLD && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-sm text-primary hover:underline"
          >
            {showAll ? t('showLess') : t('seeMore')}
          </button>
        )}
      </div>

      {/* Always 6 columns at desktop width — a row with fewer than 6 cards means
          PRODUCTS.RELATED(slug) returned few matches (small catalogue, or few
          products share this listing's category/tags), not a broken grid. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {displayed.map((p) => (
          <RelatedProductCard key={p.id} product={p} locale={locale} />
        ))}
      </div>
    </section>
  );
}
