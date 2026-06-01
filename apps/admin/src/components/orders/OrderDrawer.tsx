'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  X, Check, Package, Truck, MapPin, User,
  ExternalLink, Save, Mail, DollarSign,
} from 'lucide-react';
import { format } from 'date-fns';
import { OrderStatusBadge, ALL_STATUSES } from './OrderStatusBadge';
import { CustomizationPreviewModal } from './CustomizationPreviewModal';
import { clientFetch } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id:                string;
  productId:         string;
  productName:       string;
  productSlug:       string;
  variantName?:      string;
  quantity:          number;
  unitPrice:         number;
  customizationData?: Record<string, unknown>;
  previewUrl?:       string;
  imageUrl?:         string;
}

export interface OrderDetail {
  id:             string;
  orderNumber:    string;
  status:         string;
  total:          number;
  subtotal?:      number;
  shippingAmount?: number;
  discountAmount?: number;
  createdAt:      string;
  confirmedAt?:   string;
  shippedAt?:     string;
  deliveredAt?:   string;
  cancelledAt?:   string;
  trackingNumber?: string;
  trackingCarrier?: string;
  shippingAddress: string | Record<string, unknown>;
  shippingMethod?: { name: string; carrier?: string };
  customer: {
    id:        string;
    firstName?: string;
    lastName?:  string;
    email:     string;
    phone?:    string;
  };
  items: OrderItem[];
  statusHistory?: { status: string; createdAt: string; note?: string }[];
}

// ── Status timeline ────────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  'PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED',
] as const;

const STEP_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Payment Pending',
  CONFIRMED:       'Confirmed',
  IN_PRODUCTION:   'In Production',
  SHIPPED:         'Shipped',
  DELIVERED:       'Delivered',
  COMPLETED:       'Completed',
};

function getStepDate(order: OrderDetail, step: string): string | null {
  const map: Record<string, string | undefined> = {
    CONFIRMED:    order.confirmedAt,
    SHIPPED:      order.shippedAt,
    DELIVERED:    order.deliveredAt,
    COMPLETED:    order.deliveredAt,
  };
  if (step === 'PENDING_PAYMENT') return order.createdAt;
  return map[step] ?? null;
}

function StatusTimeline({ order }: { order: OrderDetail }) {
  const cancelledOrRefunded = ['CANCELLED', 'REFUNDED', 'REFUND_REQUESTED'].includes(order.status);
  const currentIdx          = TIMELINE_STEPS.indexOf(order.status as typeof TIMELINE_STEPS[number]);

  return (
    <div>
      <h5 className="font-semibold text-secondary text-sm mb-4">Order Timeline</h5>

      {cancelledOrRefunded && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-button text-sm text-red-700">
          Order {order.status === 'CANCELLED' ? 'was cancelled' : 'has a refund request'}.
        </div>
      )}

      <ol className="relative pl-6 space-y-4 border-l border-border">
        {TIMELINE_STEPS.map((step, i) => {
          const isDone    = currentIdx > i || (currentIdx === -1 && i < TIMELINE_STEPS.length);
          const isCurrent = currentIdx === i;
          const date      = getStepDate(order, step);

          return (
            <li key={step} className="relative">
              {/* Circle */}
              <span
                className={[
                  'absolute -left-[23px] w-4 h-4 rounded-full border-2 flex items-center justify-center',
                  isDone
                    ? 'bg-primary border-primary'
                    : isCurrent
                    ? 'bg-white border-primary'
                    : 'bg-white border-border',
                ].join(' ')}
              >
                {isDone && <Check className="w-2.5 h-2.5 text-white" />}
                {isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </span>

              <div className="ml-1">
                <p className={`text-sm font-medium ${isDone || isCurrent ? 'text-secondary' : 'text-muted'}`}>
                  {STEP_LABELS[step]}
                </p>
                {date && (
                  <p className="text-xs text-muted mt-0.5">
                    {format(new Date(date), 'MMM d, yyyy · h:mm a')}
                  </p>
                )}
                {!date && !isDone && (
                  <p className="text-xs text-muted mt-0.5">Estimated</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Order items ────────────────────────────────────────────────────────────────

function OrderItems({ items }: { items: OrderItem[] }) {
  const [previewItem, setPreviewItem] = useState<OrderItem | null>(null);

  return (
    <div className="mt-6">
      <h5 className="font-semibold text-secondary text-sm mb-3">
        Items ({items.length})
      </h5>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-background shrink-0 border border-border">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.productName}
                  width={56}
                  height={56}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-border" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-secondary text-sm truncate">{item.productName}</p>
              {item.variantName && (
                <p className="text-xs text-muted">{item.variantName}</p>
              )}
              {item.customizationData && (
                <p className="text-xs text-muted italic truncate">
                  Personalized
                  {item.customizationData['name_text']
                    ? ` — "${item.customizationData['name_text']}"`
                    : ''}
                </p>
              )}
              {item.customizationData && (
                <button
                  type="button"
                  onClick={() => setPreviewItem(item)}
                  className="text-xs text-primary hover:underline mt-0.5"
                >
                  👁 View Customization
                </button>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-medium text-secondary">
                ${(item.unitPrice * item.quantity).toFixed(2)}
              </p>
              <p className="text-xs text-muted">{item.quantity} × ${item.unitPrice.toFixed(2)}</p>
            </div>
          </li>
        ))}
      </ul>

      {previewItem && (
        <CustomizationPreviewModal
          customizationData={previewItem.customizationData ?? {}}
          previewUrl={previewItem.previewUrl}
          productName={previewItem.productName}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}

// ── Shipping info ──────────────────────────────────────────────────────────────

function ShippingInfo({ order, onUpdate }: { order: OrderDetail; onUpdate: () => void }) {
  const [carrier,  setCarrier]  = useState(order.trackingCarrier ?? 'FedEx');
  const [tracking, setTracking] = useState(order.trackingNumber ?? '');
  const [saving,   setSaving]   = useState(false);

  const address =
    typeof order.shippingAddress === 'string'
      ? (() => { try { return JSON.parse(order.shippingAddress); } catch { return {}; } })()
      : order.shippingAddress;

  const saveTracking = async () => {
    setSaving(true);
    try {
      await clientFetch(`/admin/orders/${order.id}/tracking`, {
        method: 'PATCH',
        body:   JSON.stringify({ trackingNumber: tracking, carrier }),
      });
      onUpdate();
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const trackingUrl =
    carrier === 'FedEx'  ? `https://www.fedex.com/fedextrack/?trknbr=${tracking}` :
    carrier === 'USPS'   ? `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${tracking}` :
    carrier === 'UPS'    ? `https://www.ups.com/track?tracknum=${tracking}` :
    carrier === 'DHL'    ? `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}` :
    null;

  return (
    <div className="mt-6 pt-5 border-t border-border">
      <h5 className="font-semibold text-secondary text-sm mb-3 flex items-center gap-2">
        <Truck className="w-4 h-4 text-muted" />
        Shipping
      </h5>

      {/* Address */}
      <div className="flex items-start gap-2 text-sm text-secondary mb-3">
        <MapPin className="w-4 h-4 text-muted shrink-0 mt-0.5" />
        <div>
          <p>{address.fullName}</p>
          <p className="text-muted">{address.addressLine1}</p>
          {address.addressLine2 && <p className="text-muted">{address.addressLine2}</p>}
          <p className="text-muted">
            {address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}
          </p>
          <p className="text-muted">{address.country}</p>
        </div>
      </div>

      {order.shippingMethod?.name && (
        <p className="text-sm text-muted mb-3">
          <span className="font-medium text-secondary">{order.shippingMethod.name}</span>
          {order.shippingMethod.carrier && ` · ${order.shippingMethod.carrier}`}
        </p>
      )}

      {/* Tracking input */}
      <div className="flex gap-2 mt-3">
        <select
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          className="px-2 py-1.5 text-xs border border-border rounded-button bg-background text-secondary focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          {['FedEx', 'USPS', 'UPS', 'DHL'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Tracking number"
          className="flex-1 px-3 py-1.5 text-xs border border-border rounded-button bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono"
        />
        <button
          type="button"
          onClick={saveTracking}
          disabled={saving || !tracking}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-button hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          <Save className="w-3 h-3" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {order.trackingNumber && trackingUrl && (
        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Track Package — {order.trackingCarrier} {order.trackingNumber}
        </a>
      )}
    </div>
  );
}

// ── Update status ──────────────────────────────────────────────────────────────

function UpdateStatus({ order, onUpdate }: { order: OrderDetail; onUpdate: () => void }) {
  const [status,  setStatus]  = useState(order.status);
  const [note,    setNote]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await clientFetch(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body:   JSON.stringify({ status, note: note || undefined }),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onUpdate();
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 pt-5 border-t border-border">
      <h5 className="font-semibold text-secondary text-sm mb-3">Update Status</h5>

      <div className="space-y-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
        />

        <button
          type="button"
          onClick={handleUpdate}
          disabled={saving || status === order.status}
          className={[
            'w-full py-2.5 text-sm font-semibold rounded-button transition-colors',
            success
              ? 'bg-green-500 text-white'
              : 'bg-primary hover:bg-primary-dark text-white disabled:opacity-50',
          ].join(' ')}
        >
          {saving ? 'Updating…' : success ? '✓ Status Updated' : 'Update Status'}
        </button>
      </div>
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

interface OrderDrawerProps {
  order:    OrderDetail;
  onClose:  () => void;
  onUpdate: () => void;
}

export function OrderDrawer({ order, onClose, onUpdate }: OrderDrawerProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const router      = useRouter();

  // Escape key
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const customerName = [order.customer.firstName, order.customer.lastName]
    .filter(Boolean).join(' ') || order.customer.email;

  const formatDate = (d?: string) =>
    d ? format(new Date(d), 'MMM d, yyyy') : '—';

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[40] bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.orderNumber}`}
        className="fixed right-0 top-0 bottom-0 z-[50] w-[480px] max-w-[95vw] bg-surface shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-secondary font-mono">#{order.orderNumber}</h4>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-xs text-muted mt-1">
              {customerName} · {formatDate(order.createdAt)} · ${Number(order.total).toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-muted/10 rounded-full transition-colors mt-0.5"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-24">
          <StatusTimeline order={order} />
          <OrderItems items={order.items} />

          {/* Customer info */}
          <div className="mt-6 pt-5 border-t border-border">
            <h5 className="font-semibold text-secondary text-sm mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-muted" />
              Customer
            </h5>
            <div className="text-sm space-y-0.5">
              <p className="font-medium text-secondary">{customerName}</p>
              <p className="text-muted">{order.customer.email}</p>
              {order.customer.phone && <p className="text-muted">{order.customer.phone}</p>}
            </div>
            <Link
              href={`/customers/${order.customer.id}`}
              className="text-xs text-primary hover:underline mt-2 inline-block"
            >
              View Customer Profile →
            </Link>
          </div>

          <ShippingInfo order={order} onUpdate={onUpdate} />
          <UpdateStatus order={order} onUpdate={onUpdate} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-background flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Issue a refund for this order?')) return;
              await clientFetch(`/payments/${order.id}/refund`, {
                method: 'POST',
                body:   JSON.stringify({ reason: 'Admin initiated' }),
              });
              onUpdate();
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-button transition-colors"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Issue Refund
          </button>
          <button
            type="button"
            onClick={() => router.push(`/orders/${order.id}`)}
            className="flex items-center gap-1.5 text-xs font-medium text-secondary border border-border hover:border-primary/40 px-3 py-2 rounded-button transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Email Customer
          </button>
        </div>
      </aside>
    </>
  );
}
