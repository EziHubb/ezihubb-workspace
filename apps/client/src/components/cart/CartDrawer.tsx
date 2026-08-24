'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCart, useMutateCart } from '@ezihubb/api-client';
import { fmtAmount, fmtFixed, safeNum, safeArr } from '@ezihubb/utils';

interface CartDrawerProps {
  isOpen:  boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const locale = useLocale();
  const t = useTranslations('cart');
  const { data: cart, isLoading } = useCart();
  const { updateItem, removeItem } = useMutateCart();

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
        aria-label={t('drawer.title')}
        aria-modal="true"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-surface shadow-xl"
        data-testid="cart-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-secondary">
            {t('drawer.title')}
            {cart && cart.totals.itemCount > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">
                ({t('itemCount', { count: cart.totals.itemCount })})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('drawer.close')}
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

          {!isLoading && (!cart || safeArr(cart.items).length === 0) && (
            <div className="flex flex-col items-center gap-4 py-16 text-center" data-testid="cart-empty">
              <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-sm font-medium text-secondary">{t('drawer.empty')}</p>
              <Link href={`/${locale}/search`} onClick={onClose} className="text-sm text-primary hover:underline">
                {t('drawer.browseProducts')}
              </Link>
            </div>
          )}

          {!isLoading && cart && safeArr(cart.items).length > 0 && (
            <ul className="divide-y divide-border" data-testid="cart-items">
              {safeArr(cart.items).map((item) => (
                <li key={item.id} className="flex gap-3 py-4" data-testid={`cart-item-${item.id}`}>
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

                  <div className="flex flex-1 flex-col gap-1 min-w-0">
                    <Link
                      href={`/${locale}/products/${item.productSlug}`}
                      onClick={onClose}
                      className="text-sm font-medium text-secondary truncate hover:text-primary"
                    >
                      {item.productName}
                    </Link>
                    {item.variantOptions && Object.keys(item.variantOptions).length > 0 ? (
                      <p className="text-xs text-muted">
                        {Object.entries(item.variantOptions)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    ) : item.variantName ? (
                      <p className="text-xs text-muted">{item.variantName}</p>
                    ) : null}
                    {item.priceChanged && (
                      <p className="text-xs text-warning">{t('item.priceUpdated')}</p>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-1" aria-label={`Quantity for ${item.productName}`}>
                        <button
                          aria-label={t('item.decreaseQty')}
                          disabled={item.quantity <= 1 || updateItem.isPending}
                          onClick={() => updateItem.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                          className="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted hover:text-secondary disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm text-secondary" data-testid={`qty-${item.id}`}>
                          {item.quantity}
                        </span>
                        <button
                          aria-label={t('item.increaseQty')}
                          disabled={updateItem.isPending}
                          onClick={() => updateItem.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                          className="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted hover:text-secondary disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-secondary">
                          {fmtAmount(safeNum(item.currentPrice) * safeNum(item.quantity))}
                        </span>
                        <button
                          aria-label={t('item.remove', { name: item.productName })}
                          disabled={removeItem.isPending}
                          onClick={() => removeItem.mutate(item.id)}
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
        {cart && safeArr(cart.items).length > 0 && (
          <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 space-y-3" data-testid="cart-footer">
            {cart.discountAmount && cart.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">{t('drawer.discount', { couponCode: cart.couponCode ?? '' })}</span>
                <span className="text-success">−{fmtAmount(cart.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-secondary">
              <span>{t('drawer.subtotal')}</span>
              <span>{fmtAmount(cart.totals?.subtotal)}</span>
            </div>
            <p className="text-xs text-muted">{t('drawer.shippingNote')}</p>
            <Link
              href={`/${locale}/checkout`}
              onClick={onClose}
              className="block w-full rounded-button bg-primary py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
              data-testid="checkout-button"
            >
              {t('drawer.checkout', { amount: fmtFixed(cart.totals?.subtotal) })}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
