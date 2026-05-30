import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { WishlistItemDto } from '@mlh/types';
import { queryKeys } from '../queryKeys';

export function useWishlist() {
  return useQuery({
    queryKey: queryKeys.wishlist(),
    queryFn:  () => api.get<WishlistItemDto[]>(API_ROUTES.USERS.WISHLIST),
    staleTime: 60_000,
    // Don't auto-fetch for guests — they get a 401 which is normal
    retry:    false,
  });
}

// WISHLIST_QUERY_KEY is already exported from queryKeys.ts via the package index — no re-export needed here
