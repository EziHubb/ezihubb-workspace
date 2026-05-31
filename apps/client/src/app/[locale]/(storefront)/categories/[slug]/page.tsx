import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { CategoryDto, ProductListItemDto, TagDto } from '@mlh/types';
import { ProductListingLayout } from '../../../../../components/listing/ProductListingLayout';
import {
  parseSearchParams,
  buildProductsApiUrl,
  fetchPaged,
  fetchOne,
  fetchList,
} from '../../../../../components/listing/types';

export const revalidate = 30;

type SearchParamValue = string | string[] | undefined;

// ── Static params: pre-render all known category slugs ──────────────────────

export async function generateStaticParams() {
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
  try {
    const res = await fetch(`${base}/api/v1/catalog/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: CategoryDto[] };
    return (body.data ?? []).map((c) => ({ slug: c.slug }));
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
  const base     = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const category = await fetchOne<CategoryDto>(
    `${base}/api/v1/catalog/categories/${slug}`,
  );

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
  const base             = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const [category, productsResult, tags] = await Promise.all([
    fetchOne<CategoryDto>(`${base}/api/v1/catalog/categories/${slug}`),
    fetchPaged<ProductListItemDto>(
      buildProductsApiUrl(base, filters, { categorySlug: slug }),
    ),
    fetchList<TagDto>(`${base}/api/v1/catalog/tags`),
  ]);

  if (!category) notFound();

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
            {/* "All" resets to parent category page */}
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
        products={productsResult.data}
        totalCount={productsResult.total}
        totalPages={productsResult.totalPages}
        currentFilters={filters}
        categories={[]}   // Category is fixed by slug; no sidebar category filter
        tags={tags}
      />
    </>
  );
}
