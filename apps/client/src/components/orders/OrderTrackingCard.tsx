'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Copy, ExternalLink, Package, Check } from 'lucide-react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, OrderStatusBadge } from '@ezihubb/ui';
import type { OrderDto, OrderStatus } from '@ezihubb/types';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { OrderStatusTimeline } from './OrderStatusTimeline';
import { CancelCountdown } from './CancelCountdown';
import { DigitalDownloadsPanel } from './DigitalDownloadsPanel';
import { fmtAmount, safeArr } from '@ezihubb/utils';

// ── Status rank ───────────────────────────────────────────────────────────────

const STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  CONFIRMED:     0,
  IN_PRODUCTION: 1,
  SHIPPED:       2,
  DELIVERED:     3,
  COMPLETED:     4,
};

function isAtLeastShipped(status: OrderStatus): boolean {
  return (STATUS_RANK[status] ?? -1) >= 2;
}

// ── Date formatter ────────────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day:   'numeric',
  year:  'numeric',
});

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy tracking number"
      className="ml-1.5 p-1 text-muted hover:text-secondary transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-primary" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ── Cancel confirm modal ──────────────────────────────────────────────────────

interface CancelModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  onConfirm: () => void;
  loading:   boolean;
}

function CancelModal({ isOpen, onClose, onConfirm, loading }: CancelModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader onClose={onClose}>Cancel Order</ModalHeader>
      <ModalBody>
        <p className="text-sm text-secondary">
          Are you sure you want to cancel this order? This action cannot be undone.
          You will receive a full refund within 5–10 business days.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Keep Order
        </Button>
        <Button variant="destructive" onClick={onConfirm} loading={loading}>
          Yes, Cancel Order
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export interface OrderTrackingCardProps {
  order:      OrderDto;
  guestEmail?: string;
  onCancel?:  (updatedOrder: OrderDto) => void;
}

export function OrderTrackingCard({ order, guestEmail, onCancel }: OrderTrackingCardProps) {
  const [cancelOpen,    setCancelOpen]    = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError,   setCancelError]   = useState<string | null>(null);

  const showShipping = isAtLeastShipped(order.status);

  const confirmedAt =
    order.confirmedAt ??
    order.statusHistory?.find((h) => h.status === 'CONFIRMED')?.createdAt;

  const canCancel =
    order.status === 'CONFIRMED' && Boolean(confirmedAt);

  // ── Cancel handler ────────────────────────────────────────────────────────

  const handleCancel = async () => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const updated = await apiClient.post<OrderDto>(
        API_ROUTES.ORDERS.CANCEL(order.orderNumber),
        guestEmail ? { email: guestEmail } : undefined,
      );
      setCancelOpen(false);
      onCancel?.(updated);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-secondary font-mono">
            Order #{order.orderNumber}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Placed: {dateFmt.format(new Date(order.createdAt))}
          </p>
        </div>
        <OrderStatusBadge
          status={order.status as Parameters<typeof OrderStatusBadge>[0]['status']}
          size="md"
        />
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* ── Status timeline ── */}
        <OrderStatusTimeline
          currentStatus={order.status}
          history={order.statusHistory ?? []}
          orientation="vertical"
        />

        {/* ── Digital downloads — replaces the shipment tracker entirely ── */}
        {order.isDigital && (
          <DigitalDownloadsPanel items={order.items} guestEmail={guestEmail} />
        )}

        {/* ── Shipping info ── */}
        {!order.isDigital && showShipping && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-sm px-4 py-3">
              <Package className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-sm font-medium text-emerald-700">
                Your order is on its way!
              </span>
            </div>

            {order.trackingNumber && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {order.carrier && (
                    <span className="text-sm font-semibold text-secondary">
                      {order.carrier}
                    </span>
                  )}
                  <span className="text-sm font-mono text-secondary">
                    {order.trackingNumber}
                  </span>
                  <CopyButton text={order.trackingNumber} />
                </div>

                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    Track with {order.carrier ?? 'Carrier'}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Items ── */}
        <div className="border-t border-border pt-5">
          <h5 className="text-sm font-semibold text-secondary mb-3">
            Items in this order
          </h5>
          <ul className="space-y-3">
            {safeArr(order.items).map((item) => {
              const previewUrl =
                (item.customization?.['previewUrl'] as string | undefined) ??
                item.product?.imageUrl;

              return (
                <li key={item.id} className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-background border border-border shrink-0">
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt={item.product?.name ?? 'Order item'}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-muted/40" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">
                      {item.product?.name ?? 'Product'}
                    </p>
                    {item.variantName && (
                      <p className="text-xs text-muted">{item.variantName}</p>
                    )}
                  </div>

                  {/* Qty × Price */}
                  <p className="text-sm font-semibold text-secondary tabular-nums shrink-0">
                    {item.quantity} × {fmtAmount(item.unitPrice)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Actions ── */}
        <div className="border-t border-border pt-5 flex flex-wrap items-center gap-3">
          <Link href="/pages/contact">
            <Button variant="ghost" size="sm">
              Contact Support
            </Button>
          </Link>

          {canCancel && confirmedAt && (
            <CancelCountdown
              confirmedAt={confirmedAt}
              onCancel={() => setCancelOpen(true)}
              isLoading={cancelLoading}
            />
          )}
        </div>

        {cancelError && (
          <p className="text-sm text-error" role="alert">{cancelError}</p>
        )}
      </div>

      <CancelModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        loading={cancelLoading}
      />
    </div>
  );
}
