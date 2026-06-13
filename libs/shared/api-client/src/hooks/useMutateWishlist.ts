import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import { queryKeys } from '../queryKeys';

export function useMutateWishlist() {
  const qc        = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.wishlist() });

  const addToWishlist = useMutation({
    mutationFn: (productId: string) =>
      api.post<void>(API_ROUTES.USERS.WISHLIST_ITEM(productId)),
    onSuccess: invalidate,
  });

  const removeFromWishlist = useMutation({
    mutationFn: (productId: string) =>
      api.delete<void>(API_ROUTES.USERS.WISHLIST_ITEM(productId)),
    onSuccess: invalidate,
  });

  return { addToWishlist, removeFromWishlist };
}
