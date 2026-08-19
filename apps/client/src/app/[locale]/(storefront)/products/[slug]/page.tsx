import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { buildAlternates } from '../../../../../lib/seo';
import type { ProductDetailDto, ProductListItemDto, ReviewSummaryDto, CategoryDto } from '@ezihubb/types';
import type { PaginatedResponse } from '@ezihubb/types';
import { ProductBreadcrumb } from '../../../../../components/product/ProductBreadcrumb';
import type { BreadcrumbItem } from '../../../../../components/product/ProductBreadcrumb';
import { ProductStructuredData } from '../../../../../components/seo/ProductStructuredData';
import { SearchAttributionTracker } from '../../../../../components/providers/SearchAttributionTracker';
import { MarketingTracker } from '../../../../../components/providers/MarketingTracker';
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
import { ProductQandA } from '../../../../../components/product/ProductQandA';
import type { QAItem } from '../../../../../components/product/ProductQandA';
import { warnIfRejected } from '../../../../../lib/warn-if-rejected';

export const revalidate = 30;

// ── Store summary (public GET /stores/{slug}) ──────────────────────────────────
// Minimal subset of what that endpoint returns — just what SellerCard and
// ExploreRelatedSearches need. Already public/wired (used by the shop page),
// just never fetched from the PDP before.
export interface StoreSummaryDto {
  rating:      number;
  totalOrders: number;
  createdAt:   string;
  logoUrl:     string | null;
}

// ── Breadcrumbs ───────────────────────────────────────────────────────────────

const BASE = 'https://ezihubb.com';

/** DFS from the category tree root(s) down to `targetId`; [] if not found. */
function findCategoryPath(tree: CategoryDto[], targetId: string): CategoryDto[] {
  for (const node of tree) {
    if (node.id === targetId) return [node];
    const childPath = findCategoryPath(node.children ?? [], targetId);
    if (childPath.length > 0) return [node, ...childPath];
  }
  return [];
}

function buildBreadcrumbs(
  product: ProductDetailDto,
  categoryTree: CategoryDto[],
  locale: string,
  homeLabel: string,
): BreadcrumbItem[] {
  const prefix = locale !== 'en' ? `/${locale}` : '';
  const categoryPath = findCategoryPath(categoryTree, product.category.id);

  // Tree lookup failed (fetch error, or category not in the visible tree) —
  // fall back to the single leaf level DETAIL always sends, rather than
  // dropping category from the breadcrumb entirely.
  const categoryCrumbs = categoryPath.length > 0
    ? categoryPath.map((c) => ({ name: c.name, href: `${prefix}/search?category=${c.slug}` }))
    : [{ name: product.category.name, href: `${prefix}/search?category=${product.category.slug}` }];

  return [
    { name: homeLabel, href: `${prefix}/` },
    ...categoryCrumbs,
    { name: product.name, href: `${prefix}/products/${product.slug}` },
  ];
}

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const locales = ['en', 'vi'] as const;
  // Pre-renders the 48 best-selling listings, not the whole catalogue.
  //
  // This used to ask for `fields=slug` and `limit=200`. Neither is accepted:
  // ProductQueryDto has no `fields`, and PaginationDto caps limit at 48, so
  // every request 400'd, the catch below swallowed it, and NOTHING was
  // pre-rendered at all — silently, for as long as it has been there.
  //
  // Deliberately not paginating to exhaustion. generateStaticParams only
  // controls what is built ahead of time; anything absent still renders
  // on demand and is then cached, so the long tail loses nothing but a first
  // visit. Walking the whole catalogue would make build time grow with the
  // catalogue — at 10k listings that is 200+ build-time requests and 20k
  // pre-rendered pages across locales — to pre-build pages almost nobody
  // opens. Sorted by sales so the 48 that are built are the 48 most likely to
  // be hit.
  const res = await apiClient
    .get<PaginatedResponse<{ slug: string }>>(API_ROUTES.PRODUCTS.LIST, {
      params: { sort: 'bestseller', limit: 48, isActive: true },
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
  const { locale, slug } = await params;

  const product = await apiClient
    .get<ProductDetailDto>(API_ROUTES.PRODUCTS.DETAIL(slug), { next: { revalidate: 30 } })
    .catch(() => null);

  if (!product) return { title: 'Product Not Found', robots: { index: false, follow: false } };

  const description =
    product.shortDescription ??
    product.description?.slice(0, 160) ??
    `Shop ${product.name} — personalized and custom-made at EziHubb.`;
  const primaryImage = product.images?.[0];

  return {
    title: product.name,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title:       product.name,
      description,
      type:        'website',
      url:         `/products/${slug}`,
      images: primaryImage
        ? [{ url: primaryImage.url, width: 800, height: 800, alt: product.name }]
        : [{ url: '/og-default.jpg', width: 1200, height: 630 }],
    },
    alternates: buildAlternates(`/products/${slug}`, locale),
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
  const localeHeaders = { 'X-Locale': locale };

  const [productRes, reviewSummaryRes, relatedRes, moreFromShopRes, qaRes, categoryTreeRes] =
    await Promise.allSettled([
      apiClient.get<ProductDetailDto>(API_ROUTES.PRODUCTS.DETAIL(slug), {
        next: { revalidate: 30 },
        headers: localeHeaders,
      }),
      apiClient.get<ReviewSummaryDto>(API_ROUTES.PRODUCTS.REVIEW_SUMMARY(slug), {
        next: { revalidate: 60 },
      }),
      apiClient.get<ProductListItemDto[]>(API_ROUTES.PRODUCTS.RELATED(slug), {
        next: { revalidate: 300 },
        headers: localeHeaders,
      }),
      apiClient.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.PRODUCTS.LIST, {
        params: { sort: 'bestseller', limit: 4 },
        next: { revalidate: 300 },
        headers: localeHeaders,
      }),
      apiClient.get<QAItem[]>(API_ROUTES.PRODUCTS.QA(slug), {
        next: { revalidate: 60 },
      }),
      // Full tree (not just level 1) so the breadcrumb can walk a leaf category
      // back up to its ancestors — changes rarely, cached an hour.
      apiClient.get<CategoryDto[]>(API_ROUTES.CATALOG.CATEGORIES, {
        next: { revalidate: 3600 },
      }),
    ]);

  if (productRes.status === 'rejected') notFound();
  const product = productRes.value;

  // productRes already 404s above; the rest are optional sections that quietly
  // disappear on failure. Log which one broke and why — otherwise a missing
  // "Related products" block looks the same as a product with no relatives.
  warnIfRejected('product:reviewSummary', API_ROUTES.PRODUCTS.REVIEW_SUMMARY(slug), reviewSummaryRes);
  warnIfRejected('product:related',       API_ROUTES.PRODUCTS.RELATED(slug),        relatedRes);
  warnIfRejected('product:moreFromShop',  API_ROUTES.PRODUCTS.LIST,                 moreFromShopRes);
  warnIfRejected('product:qa',            API_ROUTES.PRODUCTS.QA(slug),             qaRes);
  warnIfRejected('product:categoryTree',  API_ROUTES.CATALOG.CATEGORIES,            categoryTreeRes);

  const reviewSummary = reviewSummaryRes.status === 'fulfilled'
    ? reviewSummaryRes.value : null;

  const relatedProducts = relatedRes.status === 'fulfilled'
    ? relatedRes.value : [];

  const moreFromShop = moreFromShopRes.status === 'fulfilled'
    ? moreFromShopRes.value.data : [];

  const initialQAs = qaRes.status === 'fulfilled' ? qaRes.value : [];

  const categoryTree = categoryTreeRes.status === 'fulfilled' ? categoryTreeRes.value : [];

  // Depends on `product.store.slug`, so it can't join the parallel batch above.
  // Mirrors the existing `getTranslations` sequential await below — a second,
  // independent optional fetch, not a restructure of the batch itself.
  const storeSummary = product.store?.slug
    ? await apiClient
        .get<StoreSummaryDto>(API_ROUTES.STORES.DETAIL(product.store.slug), { next: { revalidate: 300 } })
        .catch(() => null)
    : null;

  // FAQPage structured data — only published answered Q&As
  const faqStructuredData = initialQAs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: initialQAs
      .filter((q) => q.answer)
      .map((qa) => ({
        '@type': 'Question',
        name:    qa.question,
        acceptedAnswer: { '@type': 'Answer', text: qa.answer },
      })),
  } : null;

  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const breadcrumbs = buildBreadcrumbs(product, categoryTree, locale, tNav('home'));
  const absoluteCrumbs = breadcrumbs.map((b) => ({
    name: b.name,
    url:  b.href.startsWith('http') ? b.href : `${BASE}${b.href}`,
  }));

  return (
    <>
      <Suspense fallback={null}>
        <SearchAttributionTracker />
      </Suspense>
      {product.store?.id && <MarketingTracker storeId={product.store.id} productId={product.id} />}
      <ProductStructuredData
        product={product}
        reviewSummary={reviewSummary}
        locale={locale}
      />
      <BreadcrumbStructuredData items={absoluteCrumbs} />
      {faqStructuredData && faqStructuredData.mainEntity.length > 0 && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- static JSON.stringify output, not user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
        />
      )}

      <div className="max-w-[1280px] mx-auto px-3 sm:px-4 md:px-6 py-4">

        {/* ── TOP NAV ── */}
        <div className="flex items-center justify-between mb-4">
          <ProductBreadcrumb items={breadcrumbs} />
          <BackToResults />
        </div>

        {/* ── MAIN 2-COL ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-6 lg:gap-8 mb-12">
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

        {/* ── Q&A ── */}
        <ProductQandA productSlug={slug} initialQAs={initialQAs} />

        {/* ── SELLER CARD ── */}
        <SellerCard product={product} storeSummary={storeSummary} />

        {/* ── MORE FROM THIS SHOP ── */}
        {moreFromShop.length > 0 && (
          <MoreFromShop products={moreFromShop} locale={locale} />
        )}

        {/* ── YOU MAY ALSO LIKE ── */}
        {relatedProducts.length > 0 && (
          <YouMayAlsoLike products={relatedProducts} locale={locale} />
        )}

        {/* ── EXPLORE RELATED SEARCHES ── */}
        <ExploreRelatedSearches product={product} locale={locale} storeLogoUrl={storeSummary?.logoUrl ?? null} />

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
