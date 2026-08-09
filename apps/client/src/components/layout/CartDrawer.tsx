'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useCartStore } from '../../lib/store/cart.store';
import { fmtAmount, safeNum, safeArr } from '@ezihubb/utils';

/**
 * Mini cart drawer — triggered by the cart icon in Navbar.
 * Desktop: slides in from the right.
 * Mobile: slides up as a bottom sheet.
 *
 * Data: Zustand cart store.
 * Open/close: same store.
 */
export function CartDrawer() {
  const locale      = useLocale();
  const isOpen      = useCartStore((s) => s.isDrawerOpen);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const cart        = useCartStore((s) => s.cart);
  const fetchCart   = useCartStore((s) => s.fetchCart);
  const updateItem  = useCartStore((s) => s.updateItem);
  const removeItem  = useCartStore((s) => s.removeItem);

  // Track which item is being mutated to show disabled state
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const handleQtyChange = async (itemId: string, newQty: number) => {
    if (mutatingId) return;
    setMutatingId(itemId);
    try {
      if (newQty < 1) {
        await removeItem(itemId);
      } else {
        await updateItem(itemId, newQty);
      }
    } finally {
      setMutatingId(null);
    }
  };

  // Refresh cart whenever the drawer opens
  useEffect(() => {
    if (isOpen) fetchCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeDrawer]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        aria-hidden={!isOpen}
        className={[
          'fixed z-50 bg-surface shadow-xl flex flex-col transition-transform duration-300',
          // Mobile: bottom sheet
          'bottom-0 left-0 right-0 rounded-t-2xl max-h-[85dvh]',
          // Desktop: right drawer
          'md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-96 md:max-h-none md:rounded-none',
          isOpen
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-x-full md:translate-y-0',
        ].join(' ')}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-secondary text-base">
            Your Cart
            {cart && cart.totals.itemCount > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">
                ({cart.totals.itemCount}{' '}
                {cart.totals.itemCount === 1 ? 'item' : 'items'})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart"
            className="p-2 -mr-2 text-muted hover:text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!cart || safeArr(cart.items).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
              <ShoppingBag className="w-12 h-12 text-muted/25" aria-hidden />
              <p className="text-sm font-semibold text-secondary">
                Your cart is empty
              </p>
              <Link
                href={`/${locale}/search`}
                onClick={closeDrawer}
                className="text-sm text-primary hover:underline underline-offset-2"
              >
                Browse products →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {safeArr(cart.items).map((item) => {
                const thumb = item.previewUrl ?? item.productImageUrl;
                return (
                  <li key={item.id} className="flex gap-3 py-3.5">
                    <div className="relative w-14 h-14 shrink-0 rounded-sm overflow-hidden bg-muted/20 border border-border">
                      {thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={item.productName || 'Product'}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/${locale}/products/${item.productSlug}`}
                        onClick={closeDrawer}
                        className="text-sm font-medium text-secondary hover:text-primary line-clamp-2 leading-snug"
                      >
                        {item.productName}
                      </Link>
                      {item.variantOptions && Object.keys(item.variantOptions).length > 0 ? (
                        <p className="text-xs text-muted mt-0.5">
                          {Object.entries(item.variantOptions)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      ) : item.variantName ? (
                        <p className="text-xs text-muted mt-0.5">{item.variantName}</p>
                      ) : null}
                      {item.priceChanged && (
                        <p className="text-xs text-warning mt-0.5">
                          ⚠️ Price updated
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        {/* ── Quantity controls ── */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={item.quantity <= 1 ? `Remove ${item.productName}` : 'Decrease quantity'}
                            disabled={mutatingId === item.id}
                            onClick={() => handleQtyChange(item.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted hover:text-error hover:border-error disabled:opacity-40 transition-colors"
                          >
                            {item.quantity <= 1
                              ? <Trash2 className="w-3 h-3" />
                              : <span className="text-base leading-none">−</span>
                            }
                          </button>
                          <span className="w-6 text-center text-sm font-medium text-secondary tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={mutatingId === item.id}
                            onClick={() => handleQtyChange(item.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted hover:text-secondary hover:border-secondary disabled:opacity-40 transition-colors"
                          >
                            <span className="text-base leading-none">+</span>
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-secondary tabular-nums">
                          {fmtAmount(safeNum(item.currentPrice) * safeNum(item.quantity))}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {cart && safeArr(cart.items).length > 0 && (
          <div className="shrink-0 border-t border-border px-5 py-4 space-y-3 bg-surface">
            {cart.discountAmount !== null && cart.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-success font-medium">
                <span>Discount ({cart.couponCode})</span>
                <span className="tabular-nums">
                  −{fmtAmount(cart.discountAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-secondary">Subtotal</span>
              <span className="font-bold text-lg text-secondary tabular-nums">
                {fmtAmount(cart.totals?.subtotal)}
              </span>
            </div>
            <p className="text-xs text-muted">Shipping calculated at checkout</p>
            <Link
              href={`/${locale}/checkout`}
              onClick={closeDrawer}
              className="block w-full text-center py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
            >
              Checkout — {fmtAmount(cart.totals?.subtotal)}
            </Link>
            <Link
              href={`/${locale}/cart`}
              onClick={closeDrawer}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors"
            >
              View Full Cart
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
