import type { ProductDto, ReviewSummaryDto } from '@mlh/types';

interface ProductInfoProps {
  product:       ProductDto;
  reviewSummary: ReviewSummaryDto | null;
}

function StarRow({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            className={`w-4 h-4 ${i < Math.round(rating) ? 'text-warning' : 'text-border'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-sm font-semibold text-secondary">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-sm text-muted">({count} {count === 1 ? 'review' : 'reviews'})</span>
      )}
    </div>
  );
}

function PriceDisplay({
  price,
  compareAtPrice,
}: {
  price:           number;
  compareAtPrice?: number;
}) {
  const discount =
    compareAtPrice && compareAtPrice > price
      ? Math.round((1 - price / compareAtPrice) * 100)
      : 0;

  return (
    <div className="flex items-baseline flex-wrap gap-3">
      <span className="text-3xl font-bold text-primary">${price.toFixed(2)}</span>

      {compareAtPrice && compareAtPrice > price && (
        <>
          <span className="text-base text-muted line-through">${compareAtPrice.toFixed(2)}</span>
          <span className="text-sm font-semibold text-error bg-error/8 rounded-pill px-2 py-0.5">
            Save {discount}%
          </span>
        </>
      )}
    </div>
  );
}

export function ProductInfo({ product, reviewSummary }: ProductInfoProps) {
  return (
    <div className="space-y-3.5">
      {/* Category label */}
      {(product.primaryCategory ?? product.category) && (
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">
          {product.primaryCategory?.name ?? product.category?.name}
        </p>
      )}

      {/* Product name — H1 for SEO */}
      <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary leading-tight">
        {product.name}
      </h1>

      {/* Rating + sold count row */}
      <div className="flex items-center gap-4 flex-wrap">
        {reviewSummary && reviewSummary.totalReviews > 0 && (
          <StarRow
            rating={reviewSummary.averageRating}
            count={reviewSummary.totalReviews}
          />
        )}
        {product.soldCount > 0 && (
          <span className="text-sm text-muted">
            <span className="font-medium text-secondary">
              {product.soldCount.toLocaleString()}
            </span>{' '}
            sold
          </span>
        )}
      </div>

      {/* In-demand badge — show only when recent 24h sales data is available */}
      {product.soldCount24h !== undefined && product.soldCount24h >= 10 && (
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning bg-warning/8 border border-warning/20 rounded-pill px-3 py-1">
          🔥 {product.soldCount24h} people bought this in the last 24 hours
        </div>
      )}

      {/* Price */}
      <PriceDisplay
        price={product.basePrice}
        compareAtPrice={product.compareAtPrice}
      />

      {/* Short description */}
      {product.shortDescription && (
        <p className="text-sm text-secondary leading-relaxed">
          {product.shortDescription}
        </p>
      )}
    </div>
  );
}
