'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Package, MapPin, ExternalLink, AlertTriangle, MessageCircle, Download } from 'lucide-react';
import { useOrder, useCancelOrder, api } from '@ezihubb/api-client';
import { OrderStatusBadge } from '@ezihubb/ui';
import { useToast } from '@ezihubb/ui';
import type { OrderDto, OrderStatus } from '@ezihubb/types';
import { MessageShopModal } from '../../../../../../components/messages/MessageShopModal';
import { DigitalDownloadsPanel } from '../../../../../../components/orders/DigitalDownloadsPanel';
import { fmtAmount, safeArr } from '@ezihubb/utils';

// ── Status timeline config ────────────────────────────────────────────────────

const TIMELINE_STEPS: OrderStatus[] = [
  'CONFIRMED',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
];

function getStepLabels(t: ReturnType<typeof useTranslations>): Partial<Record<OrderStatus, string>> {
  return {
    CONFIRMED:     t('timeline.confirmed'),
    IN_PRODUCTION: t('timeline.inProduction'),
    SHIPPED:       t('timeline.shipped'),
    DELIVERED:     t('timeline.delivered'),
    COMPLETED:     t('timeline.completed'),
  };
}

const STATUS_WORD_KEYS = ['CANCELLED', 'REFUNDED', 'REFUND_REQUESTED', 'DISPUTED'] as const;

// ── Status timeline ───────────────────────────────────────────────────────────

function StatusTimeline({ order }: { order: OrderDto }) {
  const t = useTranslations('orderTracking');
  const tAccount = useTranslations('account');
  const isCancelled = STATUS_WORD_KEYS.includes(order.status as typeof STATUS_WORD_KEYS[number]);

  if (isCancelled) {
    const statusKey = order.status as typeof STATUS_WORD_KEYS[number];
    const statusWord = tAccount(`orders.detail.statusWords.${statusKey}` as 'orders.detail.statusWords.CANCELLED');
    return (
      <div className="flex items-center gap-2 p-4 bg-error/5 border border-error/20 rounded-card">
        <AlertTriangle className="w-4 h-4 text-error shrink-0" />
        <p className="text-sm font-medium text-error">
          {tAccount('orders.detail.cancelledMessage', { status: statusWord })}
        </p>
      </div>
    );
  }

  const stepLabels = getStepLabels(t);
  const currentIdx = TIMELINE_STEPS.indexOf(order.status as OrderStatus);

  return (
    <div
      className="relative"
      role="list"
      aria-label={tAccount('orders.detail.timelineAriaLabel')}
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
                  {stepLabels[step] ?? step}
                </p>
                {isCurrent && (
                  <p className="text-[10px] text-primary font-medium mt-0.5">{tAccount('orders.detail.current')}</p>
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
  const t = useTranslations('orderTracking');
  const tAccount = useTranslations('account');
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
            {tAccount('orders.detail.needToCancel')}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {tAccount('orders.detail.availableToCancelFor')}{' '}
            <span className="font-mono font-bold text-primary">{timeLeft}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="shrink-0 px-4 py-2 border border-error text-error text-sm font-medium rounded-button hover:bg-error/5 transition-colors"
        >
          {t('cancelButton')}
        </button>
      </div>

      {/* Confirm dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-modal shadow-modal w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-secondary text-base">
              {tAccount('orders.detail.cancelOrderTitle', { orderNumber: order.orderNumber })}
            </h3>
            <p className="text-sm text-muted">
              {tAccount('orders.detail.cancelOrderBody')}
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="flex-1 py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary transition-colors"
              >
                {t('keepOrder')}
              </button>
              <button
                type="button"
                onClick={() => { setShowDialog(false); onCancel(); }}
                className="flex-1 py-2.5 bg-error text-white text-sm font-bold rounded-button hover:bg-red-700 transition-colors"
              >
                {tAccount('orders.detail.yesCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const locale      = useLocale();
  const t           = useTranslations('orderTracking');
  const tAccount    = useTranslations('account');
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const toast = useToast();

  const fmt = new Intl.DateTimeFormat(locale, {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const { data: order, isLoading, isError } = useOrder(orderNumber ?? '');
  const cancelMutation = useCancelOrder();
  const [isMessageOpen, setIsMessageOpen] = useState(false);

  const handleCancel = () => {
    cancelMutation.mutate(orderNumber!, {
      onSuccess: () => toast.success(tAccount('orders.detail.cancelSuccessToast')),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : tAccount('orders.detail.cancelErrorToast')),
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
        <p className="text-secondary font-medium">{tAccount('orders.detail.orderNotFound')}</p>
        <Link
          href={`/${locale}/account/orders`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {tAccount('orders.detail.backToOrders')}
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
        {tAccount('orders.detail.backToOrders')}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-secondary font-mono">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {tAccount('orders.detail.placed', { date: fmt.format(new Date(order.createdAt)) })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OrderStatusBadge
            status={order.status as Parameters<typeof OrderStatusBadge>[0]['status']}
            label={t(`orderStatusBadge.${order.status}` as Parameters<typeof t>[0])}
            size="md"
          />
          <button
            type="button"
            onClick={async () => {
              const { url } = await api.get<{ url: string }>(`/orders/${order.id}/invoice`);
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm hover:border-primary hover:text-primary transition-colors"
          >
            <Download className="w-4 h-4" />
            {tAccount('orders.detail.downloadInvoice')}
          </button>
          <button
            type="button"
            onClick={() => setIsMessageOpen(true)}
            className="flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm hover:border-primary hover:text-primary transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {t('contactSupport')}
          </button>
        </div>
      </div>

      <MessageShopModal
        isOpen={isMessageOpen}
        onClose={() => setIsMessageOpen(false)}
        context={{ orderId: order.id, orderNumber: order.orderNumber }}
      />

      {/* Status timeline */}
      <section className="bg-surface border border-border rounded-card p-5">
        <StatusTimeline order={order} />
      </section>

      {/* Cancel section */}
      <CancelSection order={order} onCancel={handleCancel} />

      {/* Digital downloads — replaces the shipment tracker entirely */}
      {order.isDigital && (
        <section>
          <h2 className="font-semibold text-secondary text-base mb-4">{tAccount('orders.detail.yourFiles')}</h2>
          <DigitalDownloadsPanel items={order.items} />
        </section>
      )}

      {/* Items */}
      <section>
        <h2 className="font-semibold text-secondary text-base mb-4">
          {tAccount('orders.detail.items', { count: safeArr(order.items).length })}
        </h2>
        <div className="space-y-3">
          {safeArr(order.items).map((item) => {
            const thumb = item.previewUrl ?? item.product?.imageUrl;

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
                  <p className="text-xs text-muted mt-0.5">{tAccount('orders.detail.qty', { count: item.quantity })}</p>
                </div>
                <p className="text-sm font-bold text-secondary tabular-nums shrink-0">
                  {fmtAmount(item.totalPrice)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom: order info sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Shipping address — physical orders only */}
        {!order.isDigital && (
          <section className="border border-border rounded-card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {tAccount('orders.detail.shippingAddress')}
            </h3>
            <address className="not-italic text-sm text-secondary leading-relaxed">
              {order.shippingName}<br />
              {addr.addressLine1}
              {addr.addressLine2 && <>, {addr.addressLine2}</>}<br />
              {addr.city}, {addr.state} {addr.postalCode}<br />
              {addr.country}
            </address>
            {addr.phone && <p className="text-xs text-muted">{addr.phone}</p>}
          </section>
        )}

        {/* Order totals + tracking */}
        <section className="border border-border rounded-card p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
            {tAccount('orders.detail.orderSummaryTitle')}
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted">
              <span>{tAccount('orders.detail.subtotal')}</span>
              <span>{fmtAmount(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>{tAccount('orders.detail.shipping')}</span>
              <span>
                {order.shippingCost === 0 ? (
                  <span className="text-success">{tAccount('orders.detail.free')}</span>
                ) : (
                  fmtAmount(order.shippingCost)
                )}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success">
                <span>{tAccount('orders.detail.discount')}</span>
                <span>−{fmtAmount(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-secondary border-t border-border pt-2">
              <span>{tAccount('orders.detail.total')}</span>
              <span>{fmtAmount(order.total)}</span>
            </div>
          </div>

          {/* Tracking */}
          {order.trackingNumber && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted mb-1">{tAccount('orders.detail.trackingNumber')}</p>
              <p className="text-sm font-mono text-secondary">{order.trackingNumber}</p>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {tAccount('orders.detail.trackPackage')}
                </a>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
