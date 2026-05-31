import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ProductListItemDto, ReviewSummaryDto } from '@mlh/types';
import type { ProductDto } from '@mlh/types';
import type { CustomizationTemplate } from '../../../../../lib/customizer/types';
import { DEMO_TEMPLATE } from '../../../../../lib/customizer/types';
import { ProductGallery } from '../../../../../components/product/ProductGallery';
import { ProductInfo } from '../../../../../components/product/ProductInfo';
import { ProductPageInteractive } from '../../../../../components/product/ProductPageInteractive';
import { ProductTabs } from '../../../../../components/product/ProductTabs';
import { RelatedProducts } from '../../../../../components/product/RelatedProducts';
import { ProductStructuredData } from '../../../../../components/seo/ProductStructuredData';
import { BreadcrumbStructuredData } from '../../../../../components/seo/BreadcrumbStructuredData';

export const revalidate = 30;

// ── Extended product type including customization template ────────────────────
export interface ProductDetailDto extends ProductDto {
  customizationTemplate?: CustomizationTemplate;
  soldCount24h?:          number;
}

// ── Server-side fetchers ──────────────────────────────────────────────────────

const API = () => process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

async function getProduct(slug: string): Promise<ProductDetailDto | null> {
  try {
    const res = await fetch(`${API()}/api/v1/products/${slug}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body.data ?? body) as ProductDetailDto;
  } catch {
    return null;
  }
}

async function getRelatedProducts(slug: string): Promise<ProductListItemDto[]> {
  try {
    const res = await fetch(`${API()}/api/v1/products/${slug}/related`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return (body.data ?? []) as ProductListItemDto[];
  } catch {
    return [];
  }
}

async function getReviewSummary(slug: string): Promise<ReviewSummaryDto | null> {
  try {
    const res = await fetch(`${API()}/api/v1/products/${slug}/reviews/summary`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body.data ?? null) as ReviewSummaryDto | null;
  } catch {
    return null;
  }
}

// ── Static params: pre-render all known slugs ─────────────────────────────────

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API()}/api/v1/products?limit=200`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    const products = (body.data ?? []) as ProductDto[];
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

// ── Metadata + JSON-LD ────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product  = await getProduct(slug);

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

  const [product, relatedProducts, reviewSummary] = await Promise.all([
    getProduct(slug),
    getRelatedProducts(slug),
    getReviewSummary(slug),
  ]);

  if (!product) notFound();

  // Fall back to DEMO_TEMPLATE in development / when API hasn't returned one
  const template: CustomizationTemplate | null =
    product.isPersonalizable
      ? (product.customizationTemplate ?? DEMO_TEMPLATE)
      : null;

  const BASE = 'https://maplehandmade.com';

  return (
    <>
      {/* Structured data */}
      <ProductStructuredData
        product={product}
        reviewSummary={reviewSummary}
        locale={locale}
      />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home',     url: BASE },
          { name: 'Products', url: `${BASE}/products` },
          { name: product.name, url: `${BASE}/products/${slug}` },
        ]}
      />

      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* ── 2-col layout: 55% gallery / 45% info+customizer ── */}
        <div className="grid grid-cols-1 md:grid-cols-[55fr_45fr] gap-8 lg:gap-14 items-start">

          {/* Left: Image Gallery */}
          <ProductGallery
            images={product.images ?? []}
            productName={product.name}
            soldCount={product.soldCount24h ?? product.soldCount}
          />

          {/* Right: Info + Interactive section */}
          <div className="space-y-5 md:sticky md:top-24">
            <ProductInfo
              product={product}
              reviewSummary={reviewSummary}
            />

            {/* Variant picker + customizer + cart — all client-side */}
            <ProductPageInteractive
              product={product}
              template={template}
              locale={locale}
            />
          </div>
        </div>

        {/* ── Product tabs (Description / Size Guide / Shipping / Reviews) ── */}
        <div className="mt-14 md:mt-20">
          <ProductTabs
            product={product}
            reviewSummary={reviewSummary}
            locale={locale}
          />
        </div>

        {/* ── Related products ── */}
        {relatedProducts.length > 0 && (
          <div className="mt-14 md:mt-20">
            <RelatedProducts products={relatedProducts} locale={locale} />
          </div>
        )}
      </div>
    </>
  );
}
