import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import { queryKeys } from '../queryKeys';
import type { WishlistItemDto } from '@mlh/types';

export function useMutateWishlist() {
  const qc  = useQueryClient();
  const KEY = queryKeys.wishlist();

  const addToWishlist = useMutation({
    mutationFn: (productId: string) =>
      api.post<void>(API_ROUTES.USERS.WISHLIST_ITEM(productId)),

    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<WishlistItemDto[]>(KEY);
      qc.setQueryData<WishlistItemDto[]>(KEY, (old = []) => {
        if (old.some((w) => w.productId === productId)) return old;
        return [
          ...old,
          {
            id:       `opt-${productId}`,
            productId,
            addedAt:  new Date().toISOString(),
            product:  { id: productId, name: '', slug: '', basePrice: 0, isActive: true },
          },
        ];
      });
      return { previous };
    },

    onError: (err, _pid, ctx) => {
      // Item already in wishlist — keep optimistic state; invalidate to sync truth
      const code = (err as { code?: string }).code;
      if (code === 'ERR_ALREADY_IN_WISHLIST') return;
      if (ctx?.previous !== undefined) qc.setQueryData(KEY, ctx.previous);
    },

    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const removeFromWishlist = useMutation({
    mutationFn: (productId: string) =>
      api.delete<void>(API_ROUTES.USERS.WISHLIST_ITEM(productId)),

    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<WishlistItemDto[]>(KEY);
      qc.setQueryData<WishlistItemDto[]>(KEY, (old = []) =>
        old.filter((w) => w.productId !== productId),
      );
      return { previous };
    },

    onError: (_err, _pid, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(KEY, ctx.previous);
    },

    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { addToWishlist, removeFromWishlist };
}
