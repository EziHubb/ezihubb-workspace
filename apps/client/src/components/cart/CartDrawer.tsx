'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_ROUTES } from '@mlh/constants';

interface CartItem {
  id:              string;
  productId:       string;
  productName:     string;
  productSlug:     string;
  productImageUrl: string | null;
  variantId:       string | null;
  variantName:     string | null;
  quantity:        number;
  unitPrice:       number;
  currentPrice:    number;
  priceChanged:    boolean;
  customizationData: Record<string, unknown> | null;
  previewUrl:      string | null;
}

interface CartTotals {
  subtotal:  number;
  discount:  number;
  shipping:  number;
  total:     number;
  itemCount: number;
}

interface CartData {
  id:             string;
  items:          CartItem[];
  couponCode:     string | null;
  discountAmount: number | null;
  totals:         CartTotals;
}

interface CartDrawerProps {
  isOpen:   boolean;
  onClose:  () => void;
}

const CART_QUERY_KEY = ['cart'];

function apiBase() {
  return process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
}

async function fetchCart(): Promise<CartData> {
  const res = await fetch(`${apiBase()}${API_ROUTES.CART.GET}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch cart');
  const body = await res.json();
  return body?.data ?? body;
}

async function updateCartItem(itemId: string, quantity: number): Promise<CartData> {
  const res = await fetch(`${apiBase()}${API_ROUTES.CART.UPDATE_ITEM(itemId)}`, {
    method:      'PATCH',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body:        JSON.stringify({ quantity }),
  });
  if (!res.ok) throw new Error('Failed to update item');
  const body = await res.json();
  return body?.data ?? body;
}

async function removeCartItem(itemId: string): Promise<CartData> {
  const res = await fetch(`${apiBase()}${API_ROUTES.CART.REMOVE_ITEM(itemId)}`, {
    method:      'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to remove item');
  const body = await res.json();
  return body?.data ?? body;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useQuery<CartData>({
    queryKey: CART_QUERY_KEY,
    queryFn:  fetchCart,
    enabled:  isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(itemId, quantity),
    onSuccess: (updated) => queryClient.setQueryData(CART_QUERY_KEY, updated),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: (updated) => queryClient.setQueryData(CART_QUERY_KEY, updated),
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="cart-backdrop"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-surface shadow-xl"
        data-testid="cart-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-secondary">
            Your Cart
            {cart && cart.totals.itemCount > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">
                ({cart.totals.itemCount} {cart.totals.itemCount === 1 ? 'item' : 'items'})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-sm text-muted hover:text-secondary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16" data-testid="cart-loading">
              <svg className="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!isLoading && (!cart || cart.items.length === 0) && (
            <div className="flex flex-col items-center gap-4 py-16 text-center" data-testid="cart-empty">
              <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-sm font-medium text-secondary">Your cart is empty</p>
              <Link
                href="/products"
                onClick={onClose}
                className="text-sm text-primary hover:underline"
              >
                Browse products →
              </Link>
            </div>
          )}

          {!isLoading && cart && cart.items.length > 0 && (
            <ul className="divide-y divide-border" data-testid="cart-items">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-4" data-testid={`cart-item-${item.id}`}>
                  {/* Thumbnail */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-background">
                    {(item.previewUrl ?? item.productImageUrl) ? (
                      <Image
                        src={(item.previewUrl ?? item.productImageUrl)!}
                        alt={item.productName}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="h-full w-full bg-border/30" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-1 min-w-0">
                    <Link
                      href={`/products/${item.productSlug}`}
                      onClick={onClose}
                      className="text-sm font-medium text-secondary truncate hover:text-primary"
                    >
                      {item.productName}
                    </Link>
                    {item.variantName && (
                      <p className="text-xs text-muted">{item.variantName}</p>
                    )}
                    {item.priceChanged && (
                      <p className="text-xs text-warning">Price updated</p>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-1" aria-label={`Quantity for ${item.productName}`}>
                        <button
                          aria-label="Decrease quantity"
                          disabled={item.quantity <= 1 || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                          className="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted hover:text-secondary disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm text-secondary" data-testid={`qty-${item.id}`}>
                          {item.quantity}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          disabled={updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                          className="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted hover:text-secondary disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-secondary">
                          ${(item.currentPrice * item.quantity).toFixed(2)}
                        </span>
                        <button
                          aria-label={`Remove ${item.productName}`}
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(item.id)}
                          className="text-muted hover:text-error transition-colors disabled:opacity-40"
                          data-testid={`remove-item-${item.id}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {cart && cart.items.length > 0 && (
          <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 space-y-3" data-testid="cart-footer">
            {cart.discountAmount && cart.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Discount ({cart.couponCode})</span>
                <span className="text-success">−${cart.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-secondary">
              <span>Subtotal</span>
              <span>${cart.totals.subtotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted">Shipping calculated at checkout</p>
            <Link
              href="/checkout"
              onClick={onClose}
              className="block w-full rounded-button bg-primary py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
              data-testid="checkout-button"
            >
              Checkout — ${cart.totals.subtotal.toFixed(2)}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
