import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { WishlistItemDto } from '@mlh/types';
import { queryKeys } from '../queryKeys';

export function useWishlist(enabled = false) {
  return useQuery<WishlistItemDto[]>({
    queryKey: queryKeys.wishlist(),
    queryFn: async () => {
      const res = await api.get<unknown>(
        API_ROUTES.USERS.WISHLIST,
        { params: { limit: 200 } },
      );
      // Flat array (envelope already unwrapped by apiFetch to the items directly)
      if (Array.isArray(res)) return res as WishlistItemDto[];
      // Paginated { data: [...] } shape after outer envelope is unwrapped
      if (res && typeof res === 'object' && Array.isArray((res as { data?: unknown }).data)) {
        return (res as { data: WishlistItemDto[] }).data;
      }
      return [];
    },
    staleTime: 60_000,
    retry:    false,
    enabled,
  });
}
