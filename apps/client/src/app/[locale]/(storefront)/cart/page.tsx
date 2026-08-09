'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingBag, ArrowRight, RefreshCw } from 'lucide-react';
import { useCartStore } from '../../../../lib/store/cart.store';
import { CartItemRow } from '../../../../components/cart/CartItemRow';
import { OrderSummary } from '../../../../components/cart/OrderSummary';
import { fmtAmount, safeArr } from '@ezihubb/utils';

export default function CartPage() {
  const locale = useLocale();
  const t = useTranslations('cart');
  const { cart, fetchCart, isLoading, updateItem, removeItem } = useCartStore();

  useEffect(() => {
    fetchCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading && !cart) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 flex items-center justify-center min-h-[50vh]">
        <div
          className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"
          aria-label="Loading cart"
        />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!cart || safeArr(cart.items).length === 0) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-primary/30" aria-hidden />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-3">
          {t('empty.heading')}
        </h1>
        <p className="text-muted mb-8 max-w-sm leading-relaxed">
          {t('empty.description')}
        </p>
        <Link
          href={`/${locale}/search`}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-8 py-3.5 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          {t('empty.startShopping')}
          <ArrowRight className="w-4 h-4" />
        </Link>
        {/* Retry button if we have no cart at all after loading */}
        {!isLoading && (
          <button
            type="button"
            onClick={() => fetchCart()}
            className="mt-4 inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('empty.refresh')}
          </button>
        )}
      </div>
    );
  }

  // ── Price mismatch banner ──────────────────────────────────────────────────

  const priceMismatches = safeArr(cart.items).filter(
    (item) => item.currentPrice !== item.unitPrice,
  );

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-6 md:mb-8">
        {t('title')}
        <span className="text-base font-normal text-muted ml-3">
          ({t('itemCount', { count: cart.totals.itemCount })})
        </span>
      </h1>

      {priceMismatches.length > 0 && (
        <div
          role="alert"
          className="mb-6 p-4 bg-warning/8 border border-warning/25 rounded-card"
        >
          <p className="text-sm font-semibold text-warning mb-2">
            ⚠️ {t('priceChanged.banner')}
          </p>
          <ul className="space-y-1">
            {priceMismatches.map((item) => (
              <li key={item.id} className="text-sm text-secondary">
                <span className="font-medium">{item.productName}</span>:{' '}
                {t('priceChanged.detail', {
                  oldPrice: fmtAmount(item.unitPrice),
                  newPrice: fmtAmount(item.currentPrice),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2-col desktop / stacked mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-8 lg:gap-12 items-start">
        <section aria-label="Cart items">
          <ul aria-label="Items in your cart">
            {safeArr(cart.items).map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                locale={locale}
                onUpdate={(itemId, qty) => updateItem(itemId, qty)}
                onRemove={(itemId) => removeItem(itemId)}
              />
            ))}
          </ul>
          <div className="mt-6">
            <Link
              href={`/${locale}/search`}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2"
            >
              {t('continueShopping')}
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
