import type { ProductDetailDto } from '@ezihubb/types';
import type { ReviewSummaryDto } from '@ezihubb/types';
import { fmtRating } from '@ezihubb/utils';

const BASE_URL = 'https://ezihubb.com';

export interface ProductStructuredDataProps {
  product:       ProductDetailDto;
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
      // DETAIL only ever sends already-available variants (the API filters
      // isAvailable:false rows out server-side and never puts the flag itself
      // on the wire) — so `product.variants.some(v => v.isAvailable)` was
      // silently `false` for every product that had any variants at all,
      // reporting OutOfStock on in-stock listings. isActive is the one real
      // signal this DTO exposes for whether the listing is purchasable.
      availability:   product.isActive
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url:            `${BASE_URL}/${locale}/products/${product.slug}`,
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
      validFrom:       new Date().toISOString(),
      // Mirrors the published policy at /pages/returns: 30-day window,
      // covering defects/wrong-personalization/damage, not change-of-mind.
      hasMerchantReturnPolicy: {
        '@type':             'MerchantReturnPolicy',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays:   30,
        returnMethod:         'https://schema.org/ReturnByMail',
        returnFees:           'https://schema.org/FreeReturn',
        merchantReturnLink:   `${BASE_URL}/${locale}/pages/returns`,
      },
      // Mirrors the published rates at /pages/shipping-info (Standard tier).
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type':  'MonetaryAmount',
          value:    5.99,
          currency: 'USD',
        },
        shippingDestination: {
          '@type':        'DefinedRegion',
          addressCountry: 'US',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type':   'QuantitativeValue',
            minValue:  product.processingDays,
            maxValue:  product.processingDays,
            unitCode:  'd',
          },
          transitTime: {
            '@type':  'QuantitativeValue',
            minValue: 5,
            maxValue: 10,
            unitCode: 'd',
          },
        },
      },
    },
  };

  if (reviewSummary && reviewSummary.totalReviews > 0) {
    data['aggregateRating'] = {
      '@type':       'AggregateRating',
      ratingValue:   fmtRating(reviewSummary.averageRating),
      reviewCount:   reviewSummary.totalReviews,
      bestRating:    '5',
      worstRating:   '1',
    };
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- static JSON.stringify output, not user input
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
