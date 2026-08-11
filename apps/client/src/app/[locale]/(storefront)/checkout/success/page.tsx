'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, Package, Home } from 'lucide-react';
import { apiClient, queryKeys } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useCartStore } from '../../../../../lib/store/cart.store';
import type { OrderDto } from '@ezihubb/types';
import { analytics } from '../../../../../lib/analytics';
import { fmtAmount, safeArr } from '@ezihubb/utils';

// ── Animated checkmark ────────────────────────────────────────────────────────

function AnimatedCheckmark() {
  const [visible, setVisible] = useState(false);
  const pathRef = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => {
      if (pathRef.current) {
        pathRef.current.style.strokeDashoffset = '0';
      }
    }, 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div
      className={`
        w-24 h-24 rounded-full bg-success flex items-center justify-center mx-auto
        transition-all duration-500 ease-out
        ${visible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
      `}
      aria-hidden="true"
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <polyline
          ref={pathRef}
          points="10,26 20,36 38,16"
          stroke="white"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray:  60,
            strokeDashoffset: 60,
            transition:       'stroke-dashoffset 0.45s ease-in-out',
          }}
        />
      </svg>
    </div>
  );
}

// ── Copy order number ─────────────────────────────────────────────────────────

function CopyOrderNumber({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations('checkout.success');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex items-center gap-2 font-mono text-xl font-bold text-secondary bg-background border border-border rounded-button px-4 py-2 hover:border-primary transition-colors"
      aria-label={t('copyOrderNumber', { orderNumber })}
    >
      {orderNumber}
      {copied ? (
        <Check className="w-4 h-4 text-success" />
      ) : (
        <Copy className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
      )}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckoutSuccessPage() {
  const t             = useTranslations('checkout.success');
  const locale        = useLocale();
  const searchParams  = useSearchParams();
  const orderNumber  = searchParams.get('order') ?? '';
  const guestEmail   = searchParams.get('email') ?? '';
  const closeDrawer  = useCartStore((s) => s.closeDrawer);
  const clearCart    = useCartStore((s) => s.clearCart);

  // Detect guest (no access_token means not logged in)
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    setIsGuest(!localStorage.getItem('access_token'));
  }, []);

  // Close cart drawer and clear cart data immediately on landing
  useEffect(() => {
    closeDrawer();
    useCartStore.getState().clearCart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Poll order until status is no longer PENDING_PAYMENT.
   * Stops polling after first non-pending status or after 2 minutes.
   */
  const { data: order, isLoading, isError } = useQuery({
    queryKey: queryKeys.order(orderNumber),
    queryFn: () => apiClient.get<OrderDto>(
      API_ROUTES.ORDERS.DETAIL(orderNumber),
      guestEmail ? { params: { email: guestEmail } } : undefined,
    ),
    enabled:  Boolean(orderNumber),
    // Poll every 2 s while still PENDING_PAYMENT (Stripe webhook may take a moment)
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING_PAYMENT' || !status) return 2_000;
      return false; // stop polling once confirmed
    },
    gcTime:    2 * 60_000,
    staleTime: 0,
  });

  // Fire purchase event once order leaves PENDING_PAYMENT (fires exactly once)
  const purchaseFiredRef = useRef(false);
  useEffect(() => {
    if (!order || order.status === 'PENDING_PAYMENT') return;
    if (purchaseFiredRef.current) return;
    purchaseFiredRef.current = true;
    analytics.purchase({
      orderNumber: order.orderNumber,
      total:       order.total,
      subtotal:    order.subtotal,
      shipping:    order.shippingCost,
      coupon:      order.couponCode,
      items: order.items.map((item) => ({
        id:       item.productId,
        name:     item.productName,
        category: '',
        price:    Number(item.unitPrice),
        quantity: item.quantity,
      })),
    });
  }, [order?.status, order?.orderNumber]);

  // ── Fallback when no order number ──────────────────────────────────────────

  if (!orderNumber) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-16 text-center">
        <p className="text-muted mb-4">{t('orderNumberNotFound')}</p>
        <Link
          href={`/${locale}/search`}
          className="text-primary hover:underline text-sm"
        >
          {t('continueShopping')}
        </Link>
      </div>
    );
  }

  // ── Loading / polling ──────────────────────────────────────────────────────

  if (isLoading && !order) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-16 flex flex-col items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-border/30 animate-pulse mx-auto" />
        <div className="text-center space-y-2">
          <div className="h-7 bg-border/40 rounded w-56 mx-auto animate-pulse" />
          <div className="h-4 bg-border/30 rounded w-72 mx-auto animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-16 text-center">
        <p className="text-muted mb-2">{t('couldNotLoad')}</p>
        <p className="text-sm text-secondary mb-6">
          {t.rich('orderNumberIs', { orderNumber, b: (chunks) => <strong className="font-mono">{chunks}</strong> })}
        </p>
        <Link
          href={`/${locale}/search`}
          className="text-primary hover:underline text-sm"
        >
          {t('continueShopping')}
        </Link>
      </div>
    );
  }

  const addr    = order?.shippingAddress;
  const isPending = order?.status === 'PENDING_PAYMENT' || !order;

  // ── Success UI ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[640px] mx-auto px-4 md:px-8 py-12 md:py-16">

      {/* Animated checkmark */}
      <AnimatedCheckmark />

      {/* Heading */}
      <div className="mt-6 text-center space-y-2">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary">
          {isPending ? t('paymentProcessing') : t('orderConfirmed')}
        </h1>
        {isPending && (
          <p className="text-sm text-muted">
            {t('confirmingPayment')}
          </p>
        )}
      </div>

      {/* Order number */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-sm text-muted">{t('yourOrderNumber')}</p>
        <CopyOrderNumber orderNumber={orderNumber} />
        <p className="text-xs text-muted">{t('clickToCopy')}</p>
      </div>

      {/* Email confirmation */}
      {order && !isPending && addr && (
        <p className="mt-4 text-sm text-center text-muted">
          {t('confirmationSentTo')}{' '}
          <span className="font-medium text-secondary">
            {/* If we have the guest email in order, show it. Otherwise show name. */}
            {t('inbox', { name: addr.firstName ?? '' })}
          </span>
        </p>
      )}

      {/* Order summary card */}
      {order && !isPending && (
        <div className="mt-8 bg-surface border border-border rounded-card overflow-hidden">
          {/* Items */}
          <div className="p-5 space-y-3">
            <h2 className="font-semibold text-secondary text-sm">{t('orderItems')}</h2>
            {safeArr(order.items).map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="relative w-12 h-12 shrink-0 rounded-sm overflow-hidden bg-background border border-border">
                  {item.product?.imageUrl ? (
                    <Image
                      src={item.product.imageUrl}
                      alt={item.product.name ?? ''}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted/20" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary line-clamp-1">
                    {item.product?.name}
                  </p>
                  <p className="text-xs text-muted">{t('qty', { count: item.quantity })}</p>
                </div>
                <p className="text-sm font-semibold text-secondary tabular-nums shrink-0">
                  {fmtAmount(item.totalPrice)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-border px-5 py-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>{t('subtotal')}</span>
              <span>{fmtAmount(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>{t('shipping')}</span>
              <span>
                {order.shippingCost === 0 ? (
                  <span className="text-success">{t('free')}</span>
                ) : (
                  fmtAmount(order.shippingCost)
                )}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success">
                <span>{t('discount')}</span>
                <span>−{fmtAmount(order.discount)}</span>
              </div>
            )}
            {order.giftCardDiscount > 0 && (
              <div className="flex justify-between text-success">
                <span>{t('giftCard')}</span>
                <span>−{fmtAmount(order.giftCardDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-secondary border-t border-border pt-2">
              <span>{t('totalPaid')}</span>
              <span>{fmtAmount(order.total)}</span>
            </div>
          </div>

          {/* Shipping address */}
          {addr && (
            <div className="border-t border-border px-5 py-4">
              <p className="text-xs font-semibold text-secondary mb-1.5 uppercase tracking-wide">
                {t('shippingTo')}
              </p>
              <address className="not-italic text-sm text-muted leading-relaxed">
                {addr.firstName} {addr.lastName}<br />
                {addr.addressLine1}
                {addr.addressLine2 && <>, {addr.addressLine2}</>}
                <br />
                {addr.city}, {addr.state} {addr.postalCode}<br />
                {addr.country}
              </address>
            </div>
          )}

          {/* Estimated delivery */}
          <div className="border-t border-border px-5 py-4">
            <p className="text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">
              {t('estimatedDelivery')}
            </p>
            <p className="text-sm text-muted flex items-center gap-1.5">
              <Package className="w-4 h-4 text-primary" />
              {t('deliveryEstimate')}
            </p>
          </div>
        </div>
      )}

      {/* Guest: create account CTA */}
      {isGuest && (
        <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
          <p className="text-sm font-semibold text-secondary mb-1">{t('saveOrderHistory')}</p>
          <p className="text-xs text-muted mb-3">
            {t('createAccountHint')}
          </p>
          <Link
            href={`/${locale}/register`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary-dark transition-colors"
          >
            {t('createAccount')}
          </Link>
        </div>
      )}

      {/* CTA buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        {isGuest ? (
          <Link
            href={`/${locale}/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(guestEmail)}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
          >
            <Package className="w-4 h-4" />
            {t('trackMyOrder')}
          </Link>
        ) : (
          <Link
            href={`/${locale}/account/orders/${orderNumber}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
          >
            <Package className="w-4 h-4" />
            {t('trackMyOrder')}
          </Link>
        )}
        <Link
          href={`/${locale}/search`}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors"
        >
          <Home className="w-4 h-4" />
          {t('continueShopping')}
        </Link>
      </div>
    </div>
  );
}
