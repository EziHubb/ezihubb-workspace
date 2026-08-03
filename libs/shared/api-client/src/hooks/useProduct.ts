import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductDto } from '@ezihubb/types';

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['products', slug],
    queryFn:  () => api.get<ProductDto>(API_ROUTES.PRODUCTS.DETAIL(slug)),
    enabled:  Boolean(slug),
    staleTime: 120_000,
  });
}
