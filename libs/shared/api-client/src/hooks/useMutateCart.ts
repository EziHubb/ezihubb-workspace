import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type { CartDto } from '@ezihubb/types';
import { queryKeys } from '../queryKeys';

// ── Input types ───────────────────────────────────────────────────────────────

export interface AddToCartInput {
  productId:          string;
  variantId?:         string | null;
  quantity:           number;
  customizationData?: Record<string, unknown>;
  previewUrl?:        string | null;
}

export interface UpdateCartItemInput {
  itemId:   string;
  quantity: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CART_KEY = queryKeys.cart();

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMutateCart() {
  const qc = useQueryClient();

  // Refetch cart from server after any mutation settles
  const refetch = () => qc.invalidateQueries({ queryKey: CART_KEY });

  // ── Add item ────────────────────────────────────────────────────────────

  const addItem = useMutation({
    mutationFn: (input: AddToCartInput) =>
      api.post<CartDto>(API_ROUTES.CART.ADD, input),
    onSuccess: (cart) => {
      // Update cache immediately with the server response
      qc.setQueryData<CartDto>(CART_KEY, cart);
    },
    onError: refetch,
  });

  // ── Update item quantity (optimistic) ────────────────────────────────────

  const updateItem = useMutation({
    mutationFn: ({ itemId, quantity }: UpdateCartItemInput) =>
      api.patch<CartDto>(API_ROUTES.CART.UPDATE_ITEM(itemId), { quantity }),

    onMutate: async ({ itemId, quantity }) => {
      // 1. Cancel any in-flight refetches so they don't overwrite optimistic data
      await qc.cancelQueries({ queryKey: CART_KEY });
      // 2. Snapshot the previous value for rollback
      const snapshot = qc.getQueryData<CartDto>(CART_KEY);
      // 3. Optimistically update the cache
      if (snapshot) {
        qc.setQueryData<CartDto>(CART_KEY, {
          ...snapshot,
          items: snapshot.items.map((i) =>
            i.id === itemId ? { ...i, quantity } : i,
          ),
        });
      }
      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      // Rollback to snapshot on failure
      if (ctx?.snapshot) qc.setQueryData<CartDto>(CART_KEY, ctx.snapshot);
    },

    onSettled: () => {
      // Always reconcile with server truth
      qc.invalidateQueries({ queryKey: CART_KEY });
    },
  });

  // ── Remove item (optimistic) ─────────────────────────────────────────────

  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      api.delete<CartDto>(API_ROUTES.CART.REMOVE_ITEM(itemId)),

    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: CART_KEY });
      const snapshot = qc.getQueryData<CartDto>(CART_KEY);
      if (snapshot) {
        qc.setQueryData<CartDto>(CART_KEY, {
          ...snapshot,
          items: snapshot.items.filter((i) => i.id !== itemId),
        });
      }
      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData<CartDto>(CART_KEY, ctx.snapshot);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: CART_KEY });
    },
  });

  // ── Apply coupon ─────────────────────────────────────────────────────────

  const applyCoupon = useMutation({
    mutationFn: (code: string) =>
      api.post<CartDto>('/cart/apply-coupon', { code }),
    onSuccess: (cart) => qc.setQueryData<CartDto>(CART_KEY, cart),
    onError:   refetch,
  });

  // ── Remove coupon ────────────────────────────────────────────────────────

  const removeCoupon = useMutation({
    mutationFn: () => api.delete<CartDto>('/cart/coupon'),
    onSuccess:  (cart) => qc.setQueryData<CartDto>(CART_KEY, cart),
    onError:    refetch,
  });

  // ── Clear cart ────────────────────────────────────────────────────────────

  const clearCart = useMutation({
    mutationFn: () => api.delete<CartDto>(API_ROUTES.CART.CLEAR),
    onSuccess:  () => qc.setQueryData<CartDto>(CART_KEY, null as unknown as CartDto),
    onError:    refetch,
  });

  return { addItem, updateItem, removeItem, applyCoupon, removeCoupon, clearCart };
}
