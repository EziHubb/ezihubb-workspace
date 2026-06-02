import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { PaginatedResponse, ProductListItemDto, ProductDto } from '@mlh/types';
import { queryKeys } from '../queryKeys';

// ── Query shapes ──────────────────────────────────────────────────────────────

export interface ProductsQuery {
  page?:            number;
  limit?:           number;
  category?:        string;
  categorySlug?:    string;
  collectionSlug?:  string;
  search?:          string;
  minPrice?:        number;
  maxPrice?:        number;
  minRating?:       number;
  tags?:            string[];
  sort?:            'price_asc' | 'price_desc' | 'newest' | 'bestseller' | 'rating' | 'featured';
  isPersonalizable?: boolean;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Paginated product list with full filter support. */
export function useProducts(query: ProductsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.products(query),
    queryFn:  () =>
      api.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.PRODUCTS.LIST, {
        params: query as Record<string, string | number | boolean | undefined | null>,
      }),
    staleTime: 60_000,
  });
}

/** Single product detail by slug. */
export function useProduct(slug: string) {
  return useQuery({
    queryKey: queryKeys.product(slug),
    queryFn:  () => api.get<ProductDto>(API_ROUTES.PRODUCTS.DETAIL(slug)),
    enabled:  Boolean(slug),
    staleTime: 2 * 60_000,
  });
}

/** Related products for a given slug. */
export function useRelatedProducts(slug: string, limit = 8) {
  return useQuery({
    queryKey: queryKeys.relatedProducts(slug),
    queryFn:  () =>
      api.get<ProductListItemDto[]>(API_ROUTES.PRODUCTS.RELATED(slug), {
        params: { limit },
      }),
    enabled:  Boolean(slug),
    staleTime: 5 * 60_000,
  });
}

/** Prefetch a product — call this on card hover for instant detail page load. */
export function usePrefetchProduct() {
  const qc = useQueryClient();
  return (slug: string) =>
    qc.prefetchQuery({
      queryKey: queryKeys.product(slug),
      queryFn:  () => api.get<ProductDto>(API_ROUTES.PRODUCTS.DETAIL(slug)),
      staleTime: 2 * 60_000,
    });
}
