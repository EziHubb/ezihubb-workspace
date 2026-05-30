import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ProductListItemDto, CategoryDto, TagDto } from '@mlh/types';
import { ProductListingLayout } from '../../../../components/listing/ProductListingLayout';
import {
  parseSearchParams,
  buildProductsApiUrl,
  fetchPaged,
  fetchList,
} from '../../../../components/listing/types';

export const revalidate = 30;

type SearchParamValue = string | string[] | undefined;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  return {
    title:       `All Personalized Gifts | ${t('name')}`,
    description: t('defaultDescription'),
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
  const base       = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const [productsResult, categories, tags] = await Promise.all([
    fetchPaged<ProductListItemDto>(buildProductsApiUrl(base, filters)),
    fetchList<CategoryDto>(`${base}/api/v1/catalog/categories?parentId=null`),
    fetchList<TagDto>(`${base}/api/v1/catalog/tags`),
  ]);

  return (
    <ProductListingLayout
      locale={locale}
      title="All Personalized Gifts"
      subtitle="Discover handcrafted personalized gifts for every occasion"
      products={productsResult.data}
      totalCount={productsResult.total}
      totalPages={productsResult.totalPages}
      currentFilters={filters}
      categories={categories}
      tags={tags}
    />
  );
}
