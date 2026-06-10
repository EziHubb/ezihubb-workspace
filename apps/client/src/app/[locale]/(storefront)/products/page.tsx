import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { buildAlternates } from '../../../../lib/seo';
import type { ProductListItemDto, CategoryDto, TagDto } from '@mlh/types';
import type { PaginatedResponse } from '@mlh/types';
import { ProductListingLayout } from '../../../../components/listing/ProductListingLayout';
import { parseSearchParams } from '../../../../components/listing/types';

export const dynamic = 'force-dynamic';

type SearchParamValue = string | string[] | undefined;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  const title = `All Personalized Gifts | ${t('name')}`;
  const description = t('defaultDescription');
  return {
    title,
    description,
    openGraph: { title, description, url: '/products' },
    alternates: buildAlternates('/products', locale),
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ locale: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const { locale } = await params;
  const sp         = await searchParams;
  const filters    = parseSearchParams(sp);

  // Primary fetch — products with all active filters
  const emptyPage: PaginatedResponse<ProductListItemDto> = {
    success:    true,
    data:       [],
    pagination: { page: 1, limit: 24, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    meta:       { timestamp: '', requestId: '' },
  };

  const productsRes = await apiClient
    .get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.PRODUCTS.LIST, {
      params: {
        page:       filters.page,
        limit:      24,
        sort:       filters.sort,
        minPrice:   filters.minPrice,
        maxPrice:   filters.maxPrice,
        minRating:  filters.rating,
        tags:       filters.tags.length > 0 ? filters.tags.join(',') : undefined,
        categorySlug: filters.category,
        isActive:   true,
      },
      next: { revalidate: 30 },
    })
    .catch(() => emptyPage);

  // Secondary fetches — sidebar data, non-critical
  const [categoriesRes, tagsRes] = await Promise.allSettled([
    apiClient.get<CategoryDto[]>(API_ROUTES.CATALOG.CATEGORIES, {
      params: { level: 2, isVisible: true },
      next: { revalidate: 600 },
    }),
    apiClient.get<TagDto[]>(API_ROUTES.CATALOG.TAGS, {
      next: { revalidate: 600 },
    }),
  ]);

  return (
    <ProductListingLayout
      locale={locale}
      title="All Personalized Gifts"
      subtitle="Discover handcrafted personalized gifts for every occasion"
      products={productsRes.data}
      totalCount={productsRes.pagination.total}
      totalPages={productsRes.pagination.totalPages}
      currentFilters={filters}
      categories={categoriesRes.status === 'fulfilled' ? (categoriesRes.value ?? []) : []}
      tags={tagsRes.status === 'fulfilled' ? (tagsRes.value ?? []) : []}
    />
  );
}
