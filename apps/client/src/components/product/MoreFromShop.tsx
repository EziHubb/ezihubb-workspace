import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import type { ProductListItemDto } from '@ezihubb/types';
import { fmtAmount, safeArr, safeNum } from '@ezihubb/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACEHOLDER = 'https://placehold.co/400x400/F5F1EB/999.png?text=No+Image';

// ── MiniStars ─────────────────────────────────────────────────────────────────

function MiniStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3 h-3 ${
            s <= rounded
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ── MiniProductCard ───────────────────────────────────────────────────────────

function MiniProductCard({
  product,
  locale,
}: {
  product: ProductListItemDto;
  locale:  string;
}) {
  return (
    <Link
      href={`/${locale}/products/${product.slug}`}
      className="group block"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden bg-[#F5F1EB] mb-2">
        <Image
          src={product.images?.[0]?.url ?? PLACEHOLDER}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <p className="text-sm text-secondary line-clamp-2 leading-snug">{product.name}</p>
      <p className="text-sm font-semibold text-secondary mt-0.5">
        {fmtAmount(product.basePrice)}
      </p>
      {product.rating && (
        <div className="flex items-center gap-1 mt-0.5">
          <MiniStars rating={product.rating.avg} />
          <span className="text-xs text-muted">
            ({safeNum(product.rating.count).toLocaleString()})
          </span>
        </div>
      )}
    </Link>
  );
}

// ── MoreFromShop ──────────────────────────────────────────────────────────────

interface MoreFromShopProps {
  products: ProductListItemDto[];
  locale:   string;
}

export function MoreFromShop({ products, locale }: MoreFromShopProps) {
  if (safeArr(products).length === 0) return null;

  return (
    <section className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-secondary">More from this shop</h2>
        <Link
          href={`/${locale}/search`}
          className="text-sm text-primary hover:underline"
        >
          Visit shop
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {safeArr(products).slice(0, 4).map((p) => (
          <MiniProductCard key={p.id} product={p} locale={locale} />
        ))}
      </div>
    </section>
  );
}
