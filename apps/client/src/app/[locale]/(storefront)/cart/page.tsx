'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ShoppingBag, ArrowRight, RefreshCw } from 'lucide-react';
import { useCart, useMutateCart } from '@mlh/api-client';
import { CartItemRow } from '../../../../components/cart/CartItemRow';
import { OrderSummary } from '../../../../components/cart/OrderSummary';

export default function CartPage() {
  const locale       = useLocale();
  const { data: cart, isLoading, isError, refetch } = useCart();
  const { updateItem, removeItem } = useMutateCart();

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 flex items-center justify-center min-h-[50vh]">
        <div
          className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"
          aria-label="Loading cart"
        />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <p className="text-secondary font-semibold">Failed to load cart.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 text-sm text-primary border border-primary px-4 py-2 rounded-button hover:bg-primary/5 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-primary/30" aria-hidden />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-3">
          Your cart is empty
        </h1>
        <p className="text-muted mb-8 max-w-sm leading-relaxed">
          You haven&apos;t added any items yet. Browse our personalized gifts
          collection to find something special.
        </p>
        <Link
          href={`/${locale}/products`}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-8 py-3.5 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          Start Shopping
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // ── Price mismatch banner ──────────────────────────────────────────────────

  const priceChangedItems = cart.items.filter((i) => i.priceChanged);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-6 md:mb-8">
        Shopping Cart
        <span className="text-base font-normal text-muted ml-3">
          ({cart.totals.itemCount}{' '}
          {cart.totals.itemCount === 1 ? 'item' : 'items'})
        </span>
      </h1>

      {priceChangedItems.length > 0 && (
        <div
          role="alert"
          className="mb-6 p-4 bg-warning/8 border border-warning/25 rounded-card"
        >
          <p className="text-sm font-semibold text-warning mb-2">
            ⚠️ Prices have been updated
          </p>
          <ul className="space-y-1">
            {priceChangedItems.map((item) => (
              <li key={item.id} className="text-sm text-secondary">
                <span className="font-medium">{item.productName}</span>: price
                changed from{' '}
                <span className="line-through text-muted">
                  ${item.unitPrice.toFixed(2)}
                </span>{' '}
                to{' '}
                <span className="font-semibold">${item.currentPrice.toFixed(2)}</span>.
                Cart updated.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2-col desktop / stacked mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-8 lg:gap-12 items-start">
        <section aria-label="Cart items">
          <ul aria-label="Items in your cart">
            {cart.items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                locale={locale}
                onUpdate={(itemId, qty) =>
                  updateItem.mutate({ itemId, quantity: qty })
                }
                onRemove={(itemId) => removeItem.mutate(itemId)}
              />
            ))}
          </ul>
          <div className="mt-6">
            <Link
              href={`/${locale}/products`}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2"
            >
              ← Continue Shopping
            </Link>
          </div>
        </section>

        <section aria-label="Order summary">
          <OrderSummary cart={cart} />
        </section>
      </div>
    </div>
  );
}
