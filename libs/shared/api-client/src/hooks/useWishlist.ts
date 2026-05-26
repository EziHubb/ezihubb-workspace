import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { WishlistItemDto } from '@mlh/types';

export const WISHLIST_QUERY_KEY = ['wishlist'] as const;

export function useWishlist() {
  return useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn:  () => api.get<WishlistItemDto[]>(API_ROUTES.USERS.WISHLIST),
    staleTime: 60_000,
  });
}
