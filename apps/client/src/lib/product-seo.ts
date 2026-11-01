import type { Metadata } from 'next';
import type { ProductDetailDto } from '@ezihubb/types';
import { buildAlternates } from './seo';
import { getProductSeoPrice } from './product-pricing';

export function buildProductMetadata(product: ProductDetailDto, locale: string): Metadata {
  const title = `${product.name.trim()} | EziHubb`;
  const description = ([product.shortDescription, product.description]
    .find((value) => value?.trim()) || product.name).trim().replace(/\s+/g, ' ').slice(0, 160);
  const alternates = buildAlternates(`/products/${product.slug}`, locale);
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const images = primaryImage
    ? [{ url: primaryImage.url, alt: product.name }]
    : [{ url: '/og-default.jpg', width: 1200, height: 630 }];

  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates,
    openGraph: { title, description, type: 'website', siteName: 'EziHubb', url: alternates.canonical, images },
    twitter: { card: 'summary_large_image', title, description, images },
    other: {
      'product:price:amount': String(getProductSeoPrice(product).price),
      'product:price:currency': 'USD',
      'product:availability': product.isActive ? 'in stock' : 'out of stock',
      'product:condition': 'new',
      'product:retailer_item_id': product.sku,
    },
  };
}
