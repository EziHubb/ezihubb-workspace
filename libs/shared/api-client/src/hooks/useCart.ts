import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { CartDto } from '@mlh/types';
import { queryKeys } from '../queryKeys';

export function useCart() {
  return useQuery({
    queryKey: queryKeys.cart(),
    queryFn:  () => api.get<CartDto>(API_ROUTES.CART.GET),
    // Cart data should feel snappy; 30 s is short enough that price changes
    // are caught quickly without hammering the server.
    staleTime: 30_000,
    // staleTime kept at 30s — cart changes are user-driven (add/remove/checkout)
  });
}
