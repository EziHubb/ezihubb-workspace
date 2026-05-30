'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Package, MapPin, ExternalLink, AlertTriangle } from 'lucide-react';
import { useOrder, useCancelOrder } from '@mlh/api-client';
import { OrderStatusBadge } from '@mlh/ui';
import { useToast } from '@mlh/ui';
import type { OrderDto, OrderStatus } from '@mlh/types';

// ── Status timeline config ────────────────────────────────────────────────────

const TIMELINE_STEPS: OrderStatus[] = [
  'CONFIRMED',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
];

const STEP_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED:     'Order Confirmed',
  IN_PRODUCTION: 'In Production',
  SHIPPED:       'Shipped',
  DELIVERED:     'Delivered',
  COMPLETED:     'Completed',
};

// ── Status timeline ───────────────────────────────────────────────────────────

function StatusTimeline({ order }: { order: OrderDto }) {
  const isCancelled = ['CANCELLED', 'REFUNDED', 'REFUND_REQUESTED', 'DISPUTED'].includes(
    order.status,
  );

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 p-4 bg-error/5 border border-error/20 rounded-card">
        <AlertTriangle className="w-4 h-4 text-error shrink-0" />
        <p className="text-sm font-medium text-error">
          This order has been {order.status.toLowerCase().replace('_', ' ')}.
        </p>
      </div>
    );
  }

  const currentIdx = TIMELINE_STEPS.indexOf(order.status as OrderStatus);

  return (
    <div
      className="relative"
      role="list"
      aria-label="Order status timeline"
    >
      {/* Desktop: horizontal — Mobile: vertical */}
      <div className="flex flex-col md:flex-row md:items-start gap-0 md:gap-0">
        {TIMELINE_STEPS.map((step, i) => {
          const isDone    = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isUpcoming = i > currentIdx;

          return (
            <div
              key={step}
              role="listitem"
              className="flex md:flex-col md:flex-1 items-start md:items-center gap-3 md:gap-2 relative"
            >
              {/* Connector line (mobile: vertical, desktop: horizontal) */}
              {i < TIMELINE_STEPS.length - 1 && (
                <>
                  {/* Mobile vertical line */}
                  <div
                    className={`absolute left-3.5 top-8 bottom-0 w-0.5 md:hidden ${
                      isDone || isCurrent ? 'bg-primary' : 'bg-border'
                    }`}
                    style={{ height: 'calc(100% - 28px)', top: '28px' }}
                    aria-hidden="true"
                  />
                  {/* Desktop horizontal line */}
                  <div
                    className={`hidden md:block absolute top-3.5 w-full h-0.5 left-1/2 ${
                      isDone ? 'bg-primary' : 'bg-border'
                    }`}
                    aria-hidden="true"
                  />
                </>
              )}

              {/* Circle */}
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                  isDone    ? 'bg-primary'                            : '',
                  isCurrent ? 'bg-primary ring-4 ring-primary/20'    : '',
                  isUpcoming ? 'border-2 border-border bg-background' : '',
                ].join(' ')}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-border" />
                )}
              </div>

              {/* Label */}
              <div className="md:text-center pb-6 md:pb-0 md:mt-2 md:px-1">
                <p
                  className={`text-xs font-semibold leading-tight ${
                    isDone || isCurrent ? 'text-secondary' : 'text-muted'
                  }`}
                >
                  {STEP_LABELS[step] ?? step}
                </p>
                {isCurrent && (
                  <p className="text-[10px] text-primary font-medium mt-0.5">Current</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cancel countdown ──────────────────────────────────────────────────────────

function CancelSection({
  order,
  onCancel,
}: {
  order:    OrderDto;
  onCancel: () => void;
}) {
  const confirmedEntry = order.statusHistory?.find((h) => h.status === 'CONFIRMED');
  const confirmedAt    = confirmedEntry?.createdAt ?? order.createdAt;
  const deadline       = new Date(confirmedAt).getTime() + 2 * 60 * 60 * 1000;

  const [timeLeft,   setTimeLeft]   = useState('');
  const [canCancel,  setCanCancel]  = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const computeTimeLeft = useCallback(() => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      setCanCancel(false);
      setTimeLeft('');
      return;
    }
    setCanCancel(true);
    const h = Math.floor(remaining / 3_600_000);
    const m = Math.floor((remaining % 3_600_000) / 60_000);
    const s = Math.floor((remaining % 60_000) / 1_000);
    setTimeLeft(
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    );
  }, [deadline]);

  useEffect(() => {
    if (order.status !== 'CONFIRMED') return;
    computeTimeLeft();
    const id = setInterval(computeTimeLeft, 1_000);
    return () => clearInterval(id);
  }, [order.status, computeTimeLeft]);

  if (order.status !== 'CONFIRMED' || !canCancel) return null;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border rounded-card bg-surface">
        <div>
          <p className="text-sm font-medium text-secondary">
            Need to cancel your order?
          </p>
          <p className="text-xs text-muted mt-0.5">
            Available to cancel for{' '}
            <span className="font-mono font-bold text-primary">{timeLeft}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="shrink-0 px-4 py-2 border border-error text-error text-sm font-medium rounded-button hover:bg-error/5 transition-colors"
        >
          Cancel Order
        </button>
      </div>

      {/* Confirm dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-modal shadow-modal w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-secondary text-base">
              Cancel order {order.orderNumber}?
            </h3>
            <p className="text-sm text-muted">
              This action cannot be undone. A full refund will be issued.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="flex-1 py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary transition-colors"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => { setShowDialog(false); onCancel(); }}
                className="flex-1 py-2.5 bg-error text-white text-sm font-bold rounded-button hover:bg-red-700 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Date formatter ────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const locale      = useLocale();
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const toast = useToast();

  const { data: order, isLoading, isError } = useOrder(orderNumber ?? '');
  const cancelMutation = useCancelOrder();

  const handleCancel = () => {
    cancelMutation.mutate(orderNumber!, {
      onSuccess: () => toast.success('Order cancelled. A refund will be issued within 5–7 business days.'),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Failed to cancel order'),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 bg-border/30 rounded w-32" />
        <div className="h-8 bg-border/30 rounded w-56" />
        <div className="h-24 bg-border/30 rounded-card" />
        <div className="h-48 bg-border/30 rounded-card" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-secondary font-medium">Order not found.</p>
        <Link href={`/${locale}/account/orders`} className="text-sm text-primary hover:underline">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const addr = order.shippingAddress;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/${locale}/account/orders`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        My Orders
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-secondary font-mono">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Placed {fmt.format(new Date(order.createdAt))}
          </p>
        </div>
        <OrderStatusBadge
          status={order.status as Parameters<typeof OrderStatusBadge>[0]['status']}
          size="md"
        />
      </div>

      {/* Status timeline */}
      <section className="bg-surface border border-border rounded-card p-5">
        <StatusTimeline order={order} />
      </section>

      {/* Cancel section */}
      <CancelSection order={order} onCancel={handleCancel} />

      {/* Items */}
      <section>
        <h2 className="font-semibold text-secondary text-base mb-4">
          Items ({order.items.length})
        </h2>
        <div className="space-y-3">
          {order.items.map((item) => {
            const previewUrl = (item.customization as Record<string, unknown> | null)
              ?.['previewUrl'] as string | undefined;
            const thumb = previewUrl ?? item.product?.imageUrl;

            return (
              <div
                key={item.id}
                className="flex gap-4 p-4 border border-border rounded-card"
              >
                <div className="relative w-16 h-16 shrink-0 rounded-sm overflow-hidden bg-background border border-border">
                  {thumb ? (
                    <Image src={thumb} alt={item.product?.name ?? ''} fill sizes="64px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/${locale}/products/${item.product?.slug ?? ''}`}
                    className="text-sm font-semibold text-secondary hover:text-primary transition-colors line-clamp-2"
                  >
                    {item.product?.name ?? '—'}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-bold text-secondary tabular-nums shrink-0">
                  ${item.totalPrice.toFixed(2)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom: order info sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Shipping address */}
        <section className="border border-border rounded-card p-4 space-y-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            Shipping Address
          </h3>
          <address className="not-italic text-sm text-secondary leading-relaxed">
            {addr.firstName} {addr.lastName}<br />
            {addr.addressLine1}
            {addr.addressLine2 && <>, {addr.addressLine2}</>}<br />
            {addr.city}, {addr.state} {addr.postalCode}<br />
            {addr.country}
          </address>
          {addr.phone && <p className="text-xs text-muted">{addr.phone}</p>}
        </section>

        {/* Order totals + tracking */}
        <section className="border border-border rounded-card p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
            Order Summary
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Shipping</span>
              <span>
                {order.shippingCost === 0 ? (
                  <span className="text-success">FREE</span>
                ) : (
                  `$${order.shippingCost.toFixed(2)}`
                )}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>−${order.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-secondary border-t border-border pt-2">
              <span>Total</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Tracking */}
          {order.trackingNumber && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted mb-1">Tracking number</p>
              <p className="text-sm font-mono text-secondary">{order.trackingNumber}</p>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Track Package
                </a>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
