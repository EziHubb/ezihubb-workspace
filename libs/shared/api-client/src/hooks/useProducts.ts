import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { PaginatedResponse, ProductListItemDto } from '@mlh/types';

export interface ProductsQuery {
  page?:         number;
  limit?:        number;
  category?:     string;
  collection?:   string;
  search?:       string;
  minPrice?:     number;
  maxPrice?:     number;
  sort?:         'price_asc' | 'price_desc' | 'newest' | 'bestseller' | 'rating';
  isPersonalizable?: boolean;
}

export function useProducts(query: ProductsQuery = {}) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () =>
      api.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.PRODUCTS.LIST, {
        params: query as Record<string, string | number | boolean | undefined | null>,
      }),
    staleTime: 60_000,
  });
}
