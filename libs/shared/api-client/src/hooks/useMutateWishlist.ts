import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import { WISHLIST_QUERY_KEY } from './useWishlist';

export function useMutateWishlist() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });

  const addToWishlist = useMutation({
    mutationFn: (productId: string) =>
      api.post<void>(API_ROUTES.USERS.WISHLIST, { productId }),
    onSuccess: invalidate,
  });

  const removeFromWishlist = useMutation({
    mutationFn: (productId: string) =>
      api.delete<void>(API_ROUTES.USERS.WISHLIST_ITEM(productId)),
    onSuccess: invalidate,
  });

  return { addToWishlist, removeFromWishlist };
}
