'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Tag, X, ChevronRight, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { useMutateCart } from '@mlh/api-client';
import type { CartDto } from '@mlh/types';

interface OrderSummaryProps {
  cart: CartDto;
}

export function OrderSummary({ cart }: OrderSummaryProps) {
  const locale  = useLocale();
  const router  = useRouter();
  const { applyCoupon, removeCoupon } = useMutateCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  const handleApply = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError('');

    applyCoupon.mutate(code, {
      onSuccess: () => setCouponInput(''),
      onError: (err) =>
        setCouponError(
          err instanceof Error ? err.message : 'Invalid or expired coupon code',
        ),
    });
  };

  const { totals } = cart;

  return (
    <div className="bg-surface border border-border rounded-card p-5 space-y-4 md:sticky md:top-28">
      <h2 className="font-semibold text-secondary text-base">Order Summary</h2>

      {/* Line items */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">
            Subtotal ({totals.itemCount}{' '}
            {totals.itemCount === 1 ? 'item' : 'items'})
          </span>
          <span className="font-medium text-secondary tabular-nums">
            ${totals.subtotal.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Shipping</span>
          <span className="text-muted italic text-xs">Calculated at checkout</span>
        </div>
        {cart.discountAmount !== null && cart.discountAmount > 0 && (
          <div className="flex justify-between text-success font-medium">
            <span>Discount</span>
            <span className="tabular-nums">
              −${cart.discountAmount.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Total */}
      <div className="flex justify-between items-baseline">
        <span className="font-semibold text-secondary">Estimated Total</span>
        <span className="font-bold text-xl text-secondary tabular-nums">
          ${totals.total.toFixed(2)}
        </span>
      </div>

      {/* Coupon */}
      <div>
        {cart.couponCode ? (
          <div className="flex items-start justify-between p-3 bg-success/8 border border-success/20 rounded-sm">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-success">
                  {cart.couponCode}
                </p>
                {cart.discountAmount !== null && cart.discountAmount > 0 && (
                  <p className="text-xs text-success/80">
                    −${cart.discountAmount.toFixed(2)} applied
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeCoupon.mutate()}
              disabled={removeCoupon.isPending}
              aria-label="Remove coupon"
              className="p-0.5 text-success/60 hover:text-error transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value);
                  if (couponError) setCouponError('');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
                placeholder="Coupon code"
                autoCapitalize="characters"
                spellCheck={false}
                aria-label="Coupon code"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={handleApply}
                disabled={!couponInput.trim() || applyCoupon.isPending}
                className="px-4 py-2 text-sm font-semibold border border-primary text-primary rounded-button hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {applyCoupon.isPending ? '…' : 'Apply'}
              </button>
            </div>
            {couponError && (
              <p className="text-xs text-error" role="alert">{couponError}</p>
            )}
          </div>
        )}
      </div>

      {/* Checkout CTA */}
      <button
        type="button"
        onClick={() => router.push(`/${locale}/checkout`)}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
      >
        Proceed to Checkout
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Trust badges */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted border-t border-border pt-3">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          Secure
        </span>
        <span className="flex items-center gap-1">
          <Truck className="w-3.5 h-3.5 text-primary" />
          Free over $50
        </span>
        <span className="flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5 text-secondary" />
          30-day returns
        </span>
      </div>
    </div>
  );
}
