'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type { CheckoutIntentDto } from '@ezihubb/types';
import { queryKeys } from '../queryKeys';

// ── Input / response types ────────────────────────────────────────────────────

export interface ShippingAddressInput {
  firstName:     string;
  lastName:      string;
  phone:         string;
  addressLine1:  string;
  addressLine2?: string;
  city:          string;
  state?:        string;
  postalCode:    string;
  country:       string;
}

/** Create a new order with an inline shipping address (supports guests). */
export interface SubmitCheckoutInput {
  idempotencyKey?: string; // Persist this opaque value in callers needing reload recovery.
  email?:          string;   // guest only
  shippingAddress: ShippingAddressInput;
  couponCode?:     string;
  giftCardCode?:   string;
  notes?:          string;
}

export interface SubmitCheckoutResponse {
  orderId:         string;
  orderNumber:     string;
  clientSecret:    string | null;
  paymentRequired: boolean;
  total:           number;
  status:          string;
}

export interface ValidateGiftCardResponse {
  isValid:     boolean;
  balance:     number;
  maxApplied:  number;
  code:        string;
  expiresAt?:  string;
  errorMessage?: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckout() {
  const qc = useQueryClient();
  const pending = useRef<{ key: string; payload: string } | null>(null);

  /** Create order with inline address — clears cart cache on success. */
  const submitOrder = useMutation({
    mutationFn: (input: SubmitCheckoutInput) => {
      const { firstName, lastName, ...address } = input.shippingAddress;
      const body = { shippingAddress: { ...address, fullName: `${firstName} ${lastName}`.trim() },
        guestEmail: input.email, couponCode: input.couponCode, giftCardCode: input.giftCardCode, note: input.notes };
      const payload = JSON.stringify(body);
      if (pending.current && (pending.current.payload !== payload
        || (input.idempotencyKey && input.idempotencyKey !== pending.current.key))) {
        throw new Error('Recover the original checkout request before changing its details.');
      }
      const key = pending.current?.key ?? input.idempotencyKey ?? crypto.randomUUID();
      pending.current = { key, payload };
      return api.post<SubmitCheckoutResponse>(API_ROUTES.ORDERS.CREATE, { ...body, idempotencyKey: key });
    },
    onSuccess: () => {
      pending.current = null;
      return qc.invalidateQueries({ queryKey: queryKeys.cart() });
    },
  });

  /** Create a Stripe PaymentIntent for an existing order. */
  const createPaymentIntent = useMutation({
    mutationFn: ({
      orderId,
      giftCardCode,
    }: {
      orderId: string;
      giftCardCode?: string;
    }) =>
      api.post<CheckoutIntentDto>(API_ROUTES.PAYMENTS.INTENT, {
        orderId,
        giftCardCode,
      }),
  });

  /** Validate a gift card code before applying. */
  const validateGiftCard = useMutation({
    mutationFn: (code: string) =>
      api.get<ValidateGiftCardResponse>(
        `${API_ROUTES.PAYMENTS.GIFT_CARD_BALANCE}?code=${encodeURIComponent(code)}`,
      ),
  });

  return { submitOrder, createPaymentIntent, validateGiftCard };
}
