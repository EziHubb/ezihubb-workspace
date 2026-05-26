import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { CartDto } from '@mlh/types';
import { CART_QUERY_KEY } from './useCart';

export interface AddToCartInput {
  productId:     string;
  variantId?:    string;
  quantity:      number;
  customization?: Record<string, unknown>;
}

export interface UpdateCartItemInput {
  quantity: number;
}

export function useMutateCart() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: CART_QUERY_KEY });

  const addItem = useMutation({
    mutationFn: (input: AddToCartInput) =>
      api.post<CartDto>(API_ROUTES.CART.ADD, input),
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, ...body }: UpdateCartItemInput & { itemId: string }) =>
      api.patch<CartDto>(API_ROUTES.CART.UPDATE_ITEM(itemId), body),
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      api.delete<CartDto>(API_ROUTES.CART.REMOVE_ITEM(itemId)),
    onSuccess: invalidate,
  });

  const clearCart = useMutation({
    mutationFn: () => api.post<CartDto>(API_ROUTES.CART.CLEAR),
    onSuccess: invalidate,
  });

  return { addItem, updateItem, removeItem, clearCart };
}
