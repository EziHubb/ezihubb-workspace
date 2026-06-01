import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@mlh/api-client';
import type { CategoryDto, ProductListItemDto } from '@mlh/types';
import type { PaginatedResponse } from '@mlh/types';
import { ProductListingLayout } from '../../../../../components/listing/ProductListingLayout';
import { parseSearchParams } from '../../../../../components/listing/types';

export const dynamic = 'force-dynamic';

type SearchParamValue = string | string[] | undefined;

// ── Static params: pre-render all known category slugs ──────────────────────

export async function generateStaticParams() {
  const locales = ['en', 'vi'] as const;
  try {
    const cats = await apiClient.get<CategoryDto[]>('/categories', {
      next: { revalidate: 3600 },
    });
    const slugs = cats.map((c) => c.slug);
    return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
  } catch {
    return [];
  }
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const category = await apiClient
    .get<CategoryDto>(`/categories/${slug}`, {
      next: { revalidate: 300 },
    })
    .catch(() => null);

  if (!category) return { title: 'Category Not Found' };
  return {
    title:       `${category.name} Gifts | Maple Handmade`,
    description: category.description ??
      `Shop personalized ${category.name} gifts handcrafted with love.`,
    openGraph: {
      title:  `${category.name} Gifts | Maple Handmade`,
      images: category.imageUrl ? [category.imageUrl] : [],
    },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params:       Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const { locale, slug } = await params;
  const sp               = await searchParams;
  const filters          = parseSearchParams(sp);

  const emptyPage: PaginatedResponse<ProductListItemDto> = {
    success:    true,
    data:       [],
    pagination: { page: 1, limit: 24, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    meta:       { timestamp: '', requestId: '' },
  };

  // Fetch category info + products in parallel
  const [categoryRes, productsRes] = await Promise.allSettled([
    apiClient.get<CategoryDto>(`/categories/${slug}`, {
      next: { revalidate: 300 },
    }),
    apiClient.get<PaginatedResponse<ProductListItemDto>>('/products', {
      params: {
        categorySlug: slug,
        page:         filters.page,
        limit:        24,
        sort:         filters.sort,
        minPrice:     filters.minPrice,
        maxPrice:     filters.maxPrice,
        isActive:     true,
      },
      next: { revalidate: 30 },
    }),
  ]);

  // 404 if category not found or API errored
  if (categoryRes.status === 'rejected' || !categoryRes.value) notFound();
  const category = categoryRes.value;

  const products   = productsRes.status === 'fulfilled' ? productsRes.value.data : [];
  const pagination = productsRes.status === 'fulfilled'
    ? productsRes.value.pagination
    : emptyPage.pagination;

  const subcategories = category.children ?? [];

  return (
    <>
      {/* Subcategory pill nav — shown when the category has children */}
      {subcategories.length > 0 && (
        <nav
          aria-label="Subcategories"
          className="max-w-[1440px] mx-auto px-4 md:px-8 pt-6 pb-0"
        >
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/${locale}/categories/${slug}`}
              className="px-4 py-2 text-sm font-medium rounded-pill bg-primary text-white border border-primary"
            >
              All {category.name}
            </Link>

            {subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/${locale}/categories/${sub.slug}`}
                className="px-4 py-2 text-sm font-medium rounded-pill border border-border text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                {sub.name}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <ProductListingLayout
        locale={locale}
        title={`${category.name} Gifts`}
        subtitle={category.description}
        products={products}
        totalCount={pagination.total}
        totalPages={pagination.totalPages}
        currentFilters={filters}
        categories={[]}
        tags={[]}
      />
    </>
  );
}
