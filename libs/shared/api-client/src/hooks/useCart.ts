import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { CartDto } from '@mlh/types';

export const CART_QUERY_KEY = ['cart'] as const;

export function useCart() {
  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn:  () => api.get<CartDto>(API_ROUTES.CART.GET),
    staleTime: 30_000,
  });
}
