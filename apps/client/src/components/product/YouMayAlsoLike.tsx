'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { useCartStore } from '../../lib/store/cart.store';
import type { ProductListItemDto } from '@mlh/types';

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
  const addItem    = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

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

        {/* Price */}
        <p className="text-sm font-bold text-secondary mt-0.5">
          ${product.basePrice.toFixed(2)}
        </p>

        {/* Stars + count */}
        {product.rating && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <MiniStars rating={product.rating.avg} size="xs" />
            <span className="text-[10px] text-muted ml-0.5">
              ({product.rating.count.toLocaleString()})
            </span>
          </div>
        )}

        {/* Sales count */}
        {product.soldCount > 0 && (
          <p className="text-[10px] text-muted">
            {product.soldCount.toLocaleString()} sales
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
          Add to cart
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
  const [showAll, setShowAll] = useState(false);

  if (products.length === 0) return null;

  const displayed = showAll ? products : products.slice(0, GRID_THRESHOLD);

  return (
    <section className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-secondary">You may also like</h2>
          <p className="text-xs text-muted">Including ads</p>
        </div>
        {products.length > GRID_THRESHOLD && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-sm text-primary hover:underline"
          >
            {showAll ? 'Show less' : 'See more'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {displayed.map((p) => (
          <RelatedProductCard key={p.id} product={p} locale={locale} />
        ))}
      </div>
    </section>
  );
}
