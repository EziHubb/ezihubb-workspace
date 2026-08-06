import type { ProductDto } from '@ezihubb/types';
import type { ReviewSummaryDto } from '@ezihubb/types';

const BASE_URL = 'https://ezihubb.com';

export interface ProductStructuredDataProps {
  product:       ProductDto;
  reviewSummary?: ReviewSummaryDto | null;
  locale?:        string;
}

/**
 * Injects Product JSON-LD structured data.
 * Place inside a Next.js Server Component page alongside the page content.
 *
 * @example
 * <ProductStructuredData product={product} reviewSummary={summary} locale={locale} />
 */
export function ProductStructuredData({
  product,
  reviewSummary,
  locale = 'en',
}: ProductStructuredDataProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:       product.name,
    description: product.description,
    image:      product.images?.map((i) => i.url) ?? [],
    sku:        product.sku,
    brand: {
      '@type': 'Brand',
      name:    'EziHubb',
    },
    offers: {
      '@type':        'Offer',
      price:          product.basePrice,
      priceCurrency:  'USD',
      // Real per-variant availability, not a hardcoded claim — Pinterest and
      // Google both penalize/reject listings whose structured data doesn't
      // match actual stock status.
      availability:   product.variants?.some((v) => v.isAvailable)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url:            `${BASE_URL}/${locale}/products/${product.slug}`,
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
    },
  };

  if (reviewSummary && reviewSummary.totalReviews > 0) {
    data['aggregateRating'] = {
      '@type':       'AggregateRating',
      ratingValue:   reviewSummary.averageRating.toFixed(1),
      reviewCount:   reviewSummary.totalReviews,
      bestRating:    '5',
      worstRating:   '1',
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
