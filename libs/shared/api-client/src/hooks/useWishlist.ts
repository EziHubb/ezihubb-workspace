import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { WishlistItemDto } from '@mlh/types';
import { queryKeys } from '../queryKeys';

export function useWishlist(enabled = false) {
  return useQuery<WishlistItemDto[]>({
    queryKey: queryKeys.wishlist(),
    queryFn: async () => {
      // Endpoint returns PaginatedResult { data: WishlistItemDto[], pagination: {...} }
      // after apiFetch unwraps the outer { success, data } envelope.
      // Extract the items array; fetch with high limit since wishlists are small.
      const res = await api.get<{ data: WishlistItemDto[] }>(
        API_ROUTES.USERS.WISHLIST,
        { params: { limit: 200 } },
      );
      return res.data ?? [];
    },
    staleTime: 60_000,
    retry:    false,
    enabled,
  });
}
