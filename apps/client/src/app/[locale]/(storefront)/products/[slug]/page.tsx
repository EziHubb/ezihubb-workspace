import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiClient } from '@mlh/api-client';
import type { ProductListItemDto, ReviewSummaryDto, ReviewDto } from '@mlh/types';
import type { ProductDto } from '@mlh/types';
import type { PaginatedResponse } from '@mlh/types';
import { DEMO_TEMPLATE } from '../../../../../lib/customizer/types';
import type { CustomizationTemplate } from '../../../../../lib/customizer/types';
import { ProductGallery } from '../../../../../components/product/ProductGallery';
import { ProductInfo } from '../../../../../components/product/ProductInfo';
import { ProductPageInteractive } from '../../../../../components/product/ProductPageInteractive';
import { ProductTabs } from '../../../../../components/product/ProductTabs';
import { RelatedProducts } from '../../../../../components/product/RelatedProducts';
import { ProductBreadcrumb } from '../../../../../components/product/ProductBreadcrumb';
import type { BreadcrumbItem } from '../../../../../components/product/ProductBreadcrumb';
import { ProductStructuredData } from '../../../../../components/seo/ProductStructuredData';
import { BreadcrumbStructuredData } from '../../../../../components/seo/BreadcrumbStructuredData';

export const revalidate = 30;

// ── Extended product type ─────────────────────────────────────────────────────
// ProductDto now includes variantOptions, attributes, customization, soldCount24h
// directly. Only add fields the API merges that aren't in ProductDto.
export interface ProductDetailDto extends ProductDto {
  richDescription?: string;
  shippingNote?: string;
}

// ── Static params: pre-render the 200 most-active product slugs ───────────────

export async function generateStaticParams() {
  const locales = ['en', 'vi'] as const;
  const res = await apiClient
    .get<PaginatedResponse<{ slug: string }>>('/products', {
      params: { fields: 'slug', limit: 200, isActive: true },
      next: { revalidate: 3600 },
    })
    .catch(() => ({ data: [] as { slug: string }[] }));

  return locales.flatMap((locale) =>
    res.data.map((p) => ({ locale, slug: p.slug })),
  );
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const product = await apiClient
    .get<ProductDetailDto>(`/products/${slug}`, {
      next: { revalidate: 30 },
    })
    .catch(() => null);

  if (!product) return { title: 'Product Not Found' };
  const description =
    product.shortDescription ??
    product.description?.slice(0, 160) ??
    `Shop ${product.name} at Maple Handmade`;
  const primaryImage = product.images?.[0];

  return {
    title:       product.name,
    description,
    robots:      { index: true, follow: true },
    openGraph: {
      title:       product.name,
      description,
      type:        'website',
      images:      primaryImage
        ? [{ url: primaryImage.url, width: 800, height: 800, alt: product.name }]
        : [{ url: '/og-default.jpg', width: 1200, height: 630 }],
    },
    other: {
      'product:price:amount':   String(product.basePrice),
      'product:price:currency': 'USD',
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  // All parallel fetches — product is critical (404 if rejected)
  const [productRes, reviewSummaryRes, relatedRes, initialReviewsRes] =
    await Promise.allSettled([
      apiClient.get<ProductDetailDto>(`/products/${slug}`, {
        next: { revalidate: 30 },
      }),
      apiClient.get<ReviewSummaryDto>(`/products/${slug}/reviews/summary`, {
        next: { revalidate: 60 },
      }),
      apiClient.get<PaginatedResponse<ProductListItemDto>>(`/products/${slug}/related`, {
        next: { revalidate: 300 },
      }),
      apiClient.get<PaginatedResponse<ReviewDto>>(`/products/${slug}/reviews`, {
        params: { page: 1, limit: 5, status: 'APPROVED' },
        next: { revalidate: 60 },
      }),
    ]);

  if (productRes.status === 'rejected') notFound();
  const product = productRes.value;

  const reviewSummary = reviewSummaryRes.status === 'fulfilled'
    ? reviewSummaryRes.value : null;

  const relatedProducts = relatedRes.status === 'fulfilled'
    ? relatedRes.value.data : [];

  const initialReviews = initialReviewsRes.status === 'fulfilled'
    ? initialReviewsRes.value.data : undefined;

  // Use product.customization (MongoDB) as gate — null means not personalizable
  const template: CustomizationTemplate | null =
    product.isPersonalizable && product.customization
      ? DEMO_TEMPLATE
      : null;

  // Breadcrumb: Home > primaryCategory > product
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: 'Home', href: `/${locale}` },
    ...(product.primaryCategory
      ? [{ name: product.primaryCategory.name, href: `/${locale}/categories/${product.primaryCategory.slug}` }]
      : []),
    { name: product.name, href: `/${locale}/products/${slug}` },
  ];

  const BASE = 'https://maplehandmade.com';

  return (
    <>
      <ProductStructuredData
        product={product}
        reviewSummary={reviewSummary}
        locale={locale}
      />
      <BreadcrumbStructuredData
        items={breadcrumbItems.map((b) => ({
          name: b.name,
          url:  b.href.startsWith('http') ? b.href : `${BASE}${b.href}`,
        }))}
      />

      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-10">
        <ProductBreadcrumb items={breadcrumbItems} />

        <div className="grid grid-cols-1 md:grid-cols-[55fr_45fr] gap-8 lg:gap-14 items-start mt-2">
          <ProductGallery
            images={product.images ?? []}
            productName={product.name}
            soldCount={product.soldCount24h}
          />

          <div className="space-y-5 md:sticky md:top-24">
            <ProductInfo
              product={product}
              reviewSummary={reviewSummary}
            />
            <ProductPageInteractive
              product={product}
              template={template}
              locale={locale}
            />
          </div>
        </div>

        <div className="mt-14 md:mt-20">
          <ProductTabs
            product={product}
            reviewSummary={reviewSummary}
            initialReviews={initialReviews}
            locale={locale}
          />
        </div>

        {relatedProducts.length > 0 && (
          <div className="mt-14 md:mt-20">
            <RelatedProducts products={relatedProducts} locale={locale} />
          </div>
        )}
      </div>
    </>
  );
}
