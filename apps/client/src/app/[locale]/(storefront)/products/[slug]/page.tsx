import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiClient } from '@mlh/api-client';
import type { ProductDto, ProductListItemDto, ReviewSummaryDto } from '@mlh/types';
import type { PaginatedResponse } from '@mlh/types';
import { ProductBreadcrumb } from '../../../../../components/product/ProductBreadcrumb';
import type { BreadcrumbItem } from '../../../../../components/product/ProductBreadcrumb';
import { ProductStructuredData } from '../../../../../components/seo/ProductStructuredData';
import { BreadcrumbStructuredData } from '../../../../../components/seo/BreadcrumbStructuredData';
import { BackToResults } from '../../../../../components/product/BackToResults';
import { ProductGalleryColumn } from '../../../../../components/product/ProductGalleryColumn';
import { ProductPurchasePanel } from '../../../../../components/product/ProductPurchasePanel';
import { ReviewsSection } from '../../../../../components/product/ReviewsSection';
import { SellerCard } from '../../../../../components/product/SellerCard';
import { MoreFromShop } from '../../../../../components/product/MoreFromShop';
import { YouMayAlsoLike } from '../../../../../components/product/YouMayAlsoLike';
import { ExploreRelatedSearches } from '../../../../../components/product/ExploreRelatedSearches';
import { ListedInfoFooter } from '../../../../../components/product/ListedInfoFooter';

export const revalidate = 30;

// ── Extended product type ─────────────────────────────────────────────────────
// Keep this export — ProductPageInteractive imports it from here.
export interface ProductDetailDto extends ProductDto {
  richDescription?: string;
  shippingNote?: string;
}

// ── Breadcrumbs ───────────────────────────────────────────────────────────────

const BASE = 'https://mapleloomhandmade.com';

function buildBreadcrumbs(product: ProductDetailDto, locale: string): BreadcrumbItem[] {
  const prefix = locale !== 'en' ? `/${locale}` : '';
  return [
    { name: 'Home', href: `${prefix}/` },
    ...(product.primaryCategory
      ? [{ name: product.primaryCategory.name, href: `${prefix}/categories/${product.primaryCategory.slug}` }]
      : []),
    { name: product.name, href: `${prefix}/products/${product.slug}` },
  ];
}

// ── Static params ─────────────────────────────────────────────────────────────

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
    .get<ProductDetailDto>(`/products/${slug}`, { next: { revalidate: 30 } })
    .catch(() => null);

  if (!product) return { title: 'Product Not Found' };

  const description =
    product.shortDescription ??
    product.description?.slice(0, 160) ??
    `Shop ${product.name} at Maple Handmade`;
  const primaryImage = product.images?.[0];

  return {
    title: product.name,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title: product.name,
      description,
      type: 'website',
      images: primaryImage
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

  const [productRes, reviewSummaryRes, relatedRes, moreFromShopRes] =
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
      apiClient.get<PaginatedResponse<ProductListItemDto>>('/products', {
        params: { sort: 'bestseller', limit: 4 },
        next: { revalidate: 300 },
      }),
    ]);

  if (productRes.status === 'rejected') notFound();
  const product = productRes.value;

  const reviewSummary = reviewSummaryRes.status === 'fulfilled'
    ? reviewSummaryRes.value : null;

  const relatedProducts = relatedRes.status === 'fulfilled'
    ? relatedRes.value.data : [];

  const moreFromShop = moreFromShopRes.status === 'fulfilled'
    ? moreFromShopRes.value.data : [];

  const breadcrumbs = buildBreadcrumbs(product, locale);
  const absoluteCrumbs = breadcrumbs.map((b) => ({
    name: b.name,
    url:  b.href.startsWith('http') ? b.href : `${BASE}${b.href}`,
  }));

  return (
    <>
      <ProductStructuredData
        product={product}
        reviewSummary={reviewSummary}
        locale={locale}
      />
      <BreadcrumbStructuredData items={absoluteCrumbs} />

      <div className="max-w-[1280px] mx-auto px-4 py-4">

        {/* ── TOP NAV ── */}
        <div className="flex items-center justify-between mb-4">
          <ProductBreadcrumb items={breadcrumbs} />
          <BackToResults />
        </div>

        {/* ── MAIN 2-COL ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 mb-12">
          <ProductGalleryColumn product={product} />
          <ProductPurchasePanel
            product={product}
            reviewSummary={reviewSummary}
            locale={locale}
          />
        </div>

        {/* ── REVIEWS ── */}
        <ReviewsSection
          productSlug={slug}
          reviewSummary={reviewSummary}
        />

        {/* ── SELLER CARD ── */}
        <SellerCard product={product} />

        {/* ── MORE FROM THIS SHOP ── */}
        {moreFromShop.length > 0 && (
          <MoreFromShop products={moreFromShop} locale={locale} />
        )}

        {/* ── YOU MAY ALSO LIKE ── */}
        {relatedProducts.length > 0 && (
          <YouMayAlsoLike products={relatedProducts} locale={locale} />
        )}

        {/* ── EXPLORE RELATED SEARCHES ── */}
        <ExploreRelatedSearches product={product} locale={locale} />

        {/* ── LISTED INFO FOOTER ── */}
        <ListedInfoFooter
          product={product}
          breadcrumbs={breadcrumbs}
          locale={locale}
        />
      </div>
    </>
  );
}
