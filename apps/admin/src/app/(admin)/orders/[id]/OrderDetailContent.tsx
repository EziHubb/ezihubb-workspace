'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check, Package, MapPin, User,
  ExternalLink, Save, Mail, DollarSign, FileText, Printer, Info,
} from 'lucide-react';
import { Select } from '@ezihubb/ui';
import { StatusSelect } from '../../../../components/orders/OrderStatusBadge';
import { useAdminMode } from '../../../../lib/store-context';
import { CustomizationPreviewModal } from '../../../../components/orders/CustomizationPreviewModal';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtDateTime } from '../../../../lib/fmt';
import { useDialog } from '../../../../contexts/DialogContext';
import type { OrderDetail, OrderItem } from '../../../../components/orders/types';

// ── Timeline (same as drawer) ─────────────────────────────────────────────────

const TIMELINE_STEPS = [
  'PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED',
] as const;
const STEP_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Payment Pending', CONFIRMED: 'Confirmed',
  IN_PRODUCTION: 'In Production',     SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',             COMPLETED: 'Completed',
};

function getStepDate(order: OrderDetail, step: string): string | null {
  const map: Record<string, string | undefined> = {
    CONFIRMED: order.confirmedAt, SHIPPED: order.shippedAt,
    DELIVERED: order.deliveredAt, COMPLETED: order.deliveredAt,
  };
  if (step === 'PENDING_PAYMENT') return order.createdAt;
  return map[step] ?? null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-5">
      <h5 className="font-semibold text-secondary text-sm mb-4">{title}</h5>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderDetailContent({ order: initialOrder }: { order: OrderDetail }) {
  const qc = useQueryClient();
  const { isPlatformContext } = useAdminMode();
  const { confirm, preview, alert } = useDialog();
  const { data: order = initialOrder } = useQuery({
    queryKey: ['admin-order', initialOrder.id],
    queryFn: () => api.get<OrderDetail>(API_ROUTES.ADMIN.ORDER(initialOrder.id)),
    initialData: initialOrder,
    staleTime: 30_000,
  });
  const [previewItem,setPreview]    = useState<OrderItem | null>(null);
  const [newStatus,  setNewStatus]  = useState(initialOrder.status);
  const [note,       setNote]       = useState('');
  const [statusSaving, setSSaving]  = useState(false);
  const [trackCarrier,  setCarrier] = useState(initialOrder.trackingCarrier ?? 'FedEx');
  const [trackNum,      setTrackNum]= useState(initialOrder.trackingNumber ?? '');
  const [trackSaving,   setTSaving] = useState(false);
  const [statusSuccess, setSSuc]    = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-order', initialOrder.id] });

  const currentIdx = TIMELINE_STEPS.indexOf(order.status as typeof TIMELINE_STEPS[number]);
  const paymentCollected = order.payment?.status === 'PAID';
  const address =
    typeof order.shippingAddress === 'string'
      ? (() => { try { return JSON.parse(order.shippingAddress); } catch { return {}; } })()
      : order.shippingAddress as Record<string, string>;

  const handleStatusUpdate = async () => {
    setSSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.ORDER_STATUS(order.id), { status: newStatus, note: note || undefined });
      setSSuc(true);
      setTimeout(() => setSSuc(false), 3000);
      refresh();
    } catch (err) {
      await alert((err as Error).message || 'Could not update order status.', { variant: 'error' });
    } finally { setSSaving(false); }
  };

  const handleTrackSave = async () => {
    setTSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.ORDER_TRACKING(order.id), { trackingNumber: trackNum, carrier: trackCarrier });
      refresh();
    } catch (err) {
      await alert((err as Error).message || 'Could not save tracking info.', { variant: 'error' });
    } finally { setTSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

      {/* Left column */}
      <div className="space-y-5">

        {!paymentCollected && (
          <div className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Order request — online payment not collected</p>
              <p className="mt-1 text-xs leading-relaxed">
                Contact the customer by email or Messages to confirm availability, the final amount, and next steps before processing.
              </p>
            </div>
          </div>
        )}

        {/* Items */}
        <Section title={`Items (${order.items.length})`}>
          <ul className="space-y-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-background border border-border shrink-0">
                  {item.imageUrl
                    ? <Image src={item.imageUrl} alt={item.productName} width={56} height={56} className="object-cover w-full h-full" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-border" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-secondary text-sm">{item.productName}</p>
                  {item.variantName && <p className="text-xs text-muted">{item.variantName}</p>}
                  {item.customizationData && (
                    <button type="button" onClick={() => setPreview(item)} className="text-xs text-primary hover:underline mt-0.5">
                      👁 View Customization
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-secondary">{fmtAmount((item.unitPrice ?? 0) * (item.quantity ?? 0))}</p>
                  <p className="text-xs text-muted">{item.quantity ?? 0} × {fmtAmount(item.unitPrice)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* Timeline */}
        <Section title="Order Timeline">
          <ol className="relative pl-6 space-y-4 border-l border-border">
            {TIMELINE_STEPS.map((step, i) => {
              const isDone = currentIdx > i; const isCurrent = currentIdx === i;
              const date   = getStepDate(order, step);
              return (
                <li key={step} className="relative">
                  <span className={`absolute -left-[23px] w-4 h-4 rounded-full border-2 flex items-center justify-center ${isDone ? 'bg-primary border-primary' : isCurrent ? 'bg-white border-primary' : 'bg-white border-border'}`}>
                    {isDone && <Check className="w-2.5 h-2.5 text-white" />}
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                  </span>
                  <div className="ml-1">
                    <p className={`text-sm font-medium ${isDone || isCurrent ? 'text-secondary' : 'text-muted'}`}>{STEP_LABELS[step]}</p>
                    {date && <p className="text-xs text-muted mt-0.5">{fmtDateTime(date)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      </div>

      {/* Right column */}
      <div className="space-y-5">

        {/* Update status */}
        <Section title="Update Status">
          <div className="space-y-3">
            <StatusSelect value={newStatus} onChange={setNewStatus} />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-button resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted" />
            <button type="button" onClick={handleStatusUpdate} disabled={statusSaving || newStatus === order.status}
              className={`w-full py-2.5 text-sm font-semibold rounded-button transition-colors ${statusSuccess ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white disabled:opacity-50'}`}>
              {statusSaving ? 'Updating…' : statusSuccess ? '✓ Updated' : 'Update Status'}
            </button>
          </div>
        </Section>

        {/* Customer */}
        <Section title="Customer">
          <div className="flex items-start gap-2 mb-2">
            <User className="w-4 h-4 text-muted shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-secondary">
                {order.customer
                  ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') || order.customer.email
                  : 'Guest'}
              </p>
              {order.customer && <p className="text-sm text-muted">{order.customer.email}</p>}
              {order.customer?.phone && <p className="text-sm text-muted">{order.customer.phone}</p>}
            </div>
          </div>
          {/* /customers is PLATFORM_ONLY, and this page is reachable by a shop
              owner as well, so the link is offered only where it can actually
              be followed. */}
          {order.customer?.id && isPlatformContext && (
            <Link href={`/customers/${order.customer.id}`} className="text-xs text-primary hover:underline">
              View Customer Profile →
            </Link>
          )}
        </Section>

        {/* Shipping */}
        <Section title="Shipping">
          <div className="flex items-start gap-2 text-sm text-secondary mb-3">
            <MapPin className="w-4 h-4 text-muted shrink-0 mt-0.5" />
            <div>
              <p>{address.fullName}</p>
              <p className="text-muted">{address.addressLine1}</p>
              {address.addressLine2 && <p className="text-muted">{address.addressLine2}</p>}
              <p className="text-muted">{address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}</p>
              <p className="text-muted">{address.country}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-28 shrink-0">
              <Select
                size="sm"
                value={trackCarrier}
                onChange={(e) => setCarrier(e.target.value)}
                options={['FedEx','USPS','UPS','DHL'].map((c) => ({ value: c, label: c }))}
              />
            </div>
            <input value={trackNum} onChange={(e) => setTrackNum(e.target.value)} placeholder="Tracking #"
              className="flex-1 px-3 py-1.5 text-xs border border-border rounded-button bg-background font-mono focus:outline-none" />
            <button type="button" onClick={handleTrackSave} disabled={trackSaving || !trackNum}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-white rounded-button hover:bg-primary-dark disabled:opacity-50 transition-colors">
              <Save className="w-3 h-3" />{trackSaving ? '…' : 'Save'}
            </button>
          </div>
          {order.trackingNumber && (
            <a href={`https://www.google.com/search?q=${order.trackingCarrier}+track+${order.trackingNumber}`} target="_blank" rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" />Track Package — {order.trackingCarrier} {order.trackingNumber}
            </a>
          )}
        </Section>

        {/* PDF downloads */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={async () => {
              const { url } = await api.get<{ url: string }>(API_ROUTES.ADMIN.ORDER_INVOICE(order.id));
              if (url) await preview(url, 'Invoice');
            }}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-secondary border border-border hover:border-primary/40 px-3 py-2 rounded-button"
          >
            <FileText className="w-3.5 h-3.5" />Invoice
          </button>
          <button
            type="button"
            onClick={async () => {
              const { url } = await api.get<{ url: string }>(API_ROUTES.ADMIN.ORDER_PACKING_SLIP(order.id));
              if (url) await preview(url, 'Packing Slip');
            }}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-secondary border border-border hover:border-primary/40 px-3 py-2 rounded-button"
          >
            <Printer className="w-3.5 h-3.5" />Packing Slip
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="button" disabled={!paymentCollected} title={!paymentCollected ? 'No online payment was collected for this order request.' : undefined} onClick={async () => { if (await confirm('Issue refund?', { title: 'Issue Refund', confirmLabel: 'Issue Refund', destructive: true })) void api.post(API_ROUTES.ADMIN.ORDER_REFUND(order.id), { reason: 'Admin' }).then(refresh); }}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-button disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent">
            <DollarSign className="w-3.5 h-3.5" />Issue Refund
          </button>
          {order.customer?.email ? (
            <a
              href={`mailto:${encodeURIComponent(order.customer.email)}?subject=${encodeURIComponent(`Your EziHubb order request ${order.orderNumber}`)}`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-secondary border border-border hover:border-primary/40 px-3 py-2 rounded-button"
            >
              <Mail className="w-3.5 h-3.5" />Email Customer
            </a>
          ) : (
            <button type="button" disabled className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-muted border border-border px-3 py-2 rounded-button opacity-60">
              <Mail className="w-3.5 h-3.5" />No customer email
            </button>
          )}
        </div>
      </div>

      {previewItem && (
        <CustomizationPreviewModal
          customizationData={previewItem.customizationData ?? {}}
          previewUrl={previewItem.previewUrl}
          productName={previewItem.productName}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
