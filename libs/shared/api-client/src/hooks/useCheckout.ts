import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { OrderDto, CheckoutIntentDto, CouponValidationResultDto } from '@mlh/types';
import { CART_QUERY_KEY } from './useCart';

export interface CreateOrderInput {
  shippingAddressId:  string;
  shippingMethodId:   string;
  couponCode?:        string;
  giftCardCode?:      string;
  notes?:             string;
}

export interface ValidateCouponInput {
  code:       string;
  orderTotal: number;
}

export function useCheckout() {
  const qc = useQueryClient();

  const createOrder = useMutation({
    mutationFn: (input: CreateOrderInput) =>
      api.post<OrderDto>(API_ROUTES.ORDERS.CREATE, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  });

  const createPaymentIntent = useMutation({
    mutationFn: (orderId: string) =>
      api.post<CheckoutIntentDto>(API_ROUTES.PAYMENTS.INTENT, { orderId }),
  });

  const validateCoupon = useMutation({
    mutationFn: (input: ValidateCouponInput) =>
      api.post<CouponValidationResultDto>(API_ROUTES.PROMOTIONS.VALIDATE, input),
  });

  const applyGiftCard = useMutation({
    mutationFn: (code: string) =>
      api.post<{ balance: number; applied: number }>(API_ROUTES.PAYMENTS.GIFT_CARD_APPLY, { code }),
  });

  return { createOrder, createPaymentIntent, validateCoupon, applyGiftCard };
}
