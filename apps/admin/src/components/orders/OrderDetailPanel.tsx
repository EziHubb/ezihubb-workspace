'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  X, Package, Truck, MapPin, User, Save, Mail, MessageSquare,
  DollarSign, Gift, ExternalLink, MoreVertical,
  Check, Ban, Printer,
} from 'lucide-react';
import { fmtDate, fmtDateTime } from '../../lib/fmt';
import { OrderStatusBadge, StatusSelect } from './OrderStatusBadge';
import { BuyLabelModal, type LabelPurchaseResult } from './BuyLabelModal';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useDialog } from '../../contexts/DialogContext';
import type { OrderDetail, OrderItem } from './OrderDrawer';

// ── Earnings tab ───────────────────────────────────────────────────────────────

interface EarningsData {
  buyerPaid: number;
  itemRevenue: number;
  shippingRevenue: number;
  couponDiscount: number;
  affiliateDiscount: number;
  referralDiscount: number;
  pointsDiscount: number;
  transactionFee: number;
  processingFee: number;
  netEarnings: number;
}

function EarningsTab({ orderId }: { orderId: string }) {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<EarningsData>(API_ROUTES.ADMIN.ORDER_EARNINGS(orderId))
      .then(setEarnings)
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- swallow so .finally still clears loading state
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <div className="py-8 text-center text-sm text-muted">Loading earnings…</div>;
  if (!earnings) return <div className="py-8 text-center text-sm text-error">Failed to load earnings</div>;

  const fmt = (n: number) => `$${Math.abs(n).toFixed(2)}`;
  const neg = (n: number) => n > 0 ? `-$${n.toFixed(2)}` : '—';

  return (
    <div className="space-y-4">
      {/* Buyer paid summary */}
      <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-secondary">Buyer paid</span>
          <span className="text-lg font-bold text-secondary">{fmt(earnings.buyerPaid)}</span>
        </div>
        <p className="text-xs text-muted mt-0.5">Total charged to buyer</p>
      </div>

      {/* Revenue breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Revenue</p>
        <Row label="Item revenue"    value={fmt(earnings.itemRevenue)} />
        <Row label="Shipping collected" value={fmt(earnings.shippingRevenue)} />
      </div>

      {/* Discounts */}
      {(earnings.couponDiscount > 0 || earnings.affiliateDiscount > 0 || earnings.referralDiscount > 0 || earnings.pointsDiscount > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Discounts applied</p>
          {earnings.couponDiscount > 0    && <Row label="Coupon discount"    value={neg(earnings.couponDiscount)}    negative />}
          {earnings.affiliateDiscount > 0 && <Row label="Affiliate discount" value={neg(earnings.affiliateDiscount)} negative />}
          {earnings.referralDiscount > 0  && <Row label="Referral discount"  value={neg(earnings.referralDiscount)}  negative />}
          {earnings.pointsDiscount > 0    && <Row label="Points discount"    value={neg(earnings.pointsDiscount)}    negative />}
        </div>
      )}

      {/* Platform fees */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Platform fees</p>
        <Row label="Transaction fee (5%)"           value={neg(earnings.transactionFee)} negative />
        <Row label="Payment processing (3% + $0.25)" value={neg(earnings.processingFee)} negative />
      </div>

      {/* Net earnings */}
      <div className="border-t border-border pt-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-secondary">Net earnings</span>
          <span className={`text-base font-bold ${earnings.netEarnings >= 0 ? 'text-green-700' : 'text-error'}`}>
            {earnings.netEarnings >= 0 ? fmt(earnings.netEarnings) : `-${fmt(-earnings.netEarnings)}`}
          </span>
        </div>
        <p className="text-xs text-muted mt-0.5">After all fees and discounts</p>
      </div>
    </div>
  );
}

function Row({ label, value, negative, muted }: { label: string; value: string; negative?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${muted ? 'text-muted' : 'text-secondary'}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${negative ? 'text-error' : muted ? 'text-muted' : 'text-secondary'}`}>{value}</span>
    </div>
  );
}

// ── Order detail tab ───────────────────────────────────────────────────────────

const PRESET_CARRIERS = ['FedEx', 'USPS', 'UPS', 'DHL', 'VNPost', 'GHN', 'GHTK', 'Other'];

function OrderDetailsTab({ order, onUpdate }: { order: OrderDetail; onUpdate: () => void }) {
  const savedCarrier  = order.trackingCarrier ?? 'FedEx';
  const isCustom      = savedCarrier !== '' && !PRESET_CARRIERS.includes(savedCarrier);
  const [carrier,    setCarrier]    = useState(isCustom ? 'Other' : savedCarrier);
  const [customCarrier, setCustomCarrier] = useState(isCustom ? savedCarrier : '');
  const [tracking,   setTracking]   = useState(order.trackingNumber ?? '');
  const [note,       setNote]       = useState((order as OrderDetail & { privateNote?: string }).privateNote ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved,  setNoteSaved]  = useState(false);
  const [savingTrk,  setSavingTrk]  = useState(false);
  const [previewItem, setPreviewItem] = useState<OrderItem | null>(null);
  const { alert } = useDialog();

  const effectiveCarrier = carrier === 'Other' ? customCarrier.trim() : carrier;

  const address = (() => {
    try {
      return typeof order.shippingAddress === 'string'
        ? JSON.parse(order.shippingAddress)
        : order.shippingAddress;
    } catch { return {}; }
  })();

  const saveNote = async () => {
    setSavingNote(true);
    try {
      await api.post(API_ROUTES.ADMIN.ORDER_NOTE(order.id), { note });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
    } catch (err) {
      await alert((err as Error).message || 'Could not save note.', { variant: 'error' });
    } finally { setSavingNote(false); }
  };

  const saveTracking = async () => {
    setSavingTrk(true);
    try {
      await api.patch(API_ROUTES.ADMIN.ORDER_TRACKING(order.id), { trackingNumber: tracking, carrier: effectiveCarrier });
      onUpdate();
    } catch (err) {
      await alert((err as Error).message || 'Could not save tracking info.', { variant: 'error' });
    } finally { setSavingTrk(false); }
  };

  const trackingUrl =
    effectiveCarrier === 'FedEx' ? `https://www.fedex.com/fedextrack/?trknbr=${tracking}` :
    effectiveCarrier === 'USPS'  ? `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${tracking}` :
    effectiveCarrier === 'UPS'   ? `https://www.ups.com/track?tracknum=${tracking}` :
    effectiveCarrier === 'DHL'   ? `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}` :
    effectiveCarrier === 'VNPost'? `https://www.vnpost.vn/en-us/dinh-vi/buu-pham?key=${tracking}` :
    effectiveCarrier === 'GHN'   ? `https://donhang.ghn.vn/?order_code=${tracking}` :
    effectiveCarrier === 'GHTK'  ? `https://i.gotit.vn/don-hang/${tracking}` : null;

  return (
    <div className="space-y-5">
      {/* Items */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Items ({order.items.length})
        </p>
        <ul className="space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3 items-start">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-background shrink-0 border border-border">
                {item.imageUrl || item.previewUrl ? (
                  <Image
                    src={(item.imageUrl ?? item.previewUrl)!}
                    alt={item.productName}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-border" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-secondary leading-tight">{item.productName}</p>
                {item.variantName && <p className="text-xs text-muted mt-0.5">{item.variantName}</p>}
                {item.customizationData && (
                  <p className="text-xs text-muted italic mt-0.5">
                    Personalized{item.customizationData['name_text'] ? ` — "${item.customizationData['name_text']}"` : ''}
                  </p>
                )}
                <p className="text-xs text-muted mt-0.5">Qty: {item.quantity}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-secondary">${(item.unitPrice * item.quantity).toFixed(2)}</p>
                <p className="text-xs text-muted">{item.quantity} × ${item.unitPrice.toFixed(2)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Gift info */}
      {order.isGift && (
        <div className="flex items-start gap-2 text-xs bg-[#FFF0EC] rounded-xl px-3 py-2.5">
          <Gift className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-primary">Gift order</span>
            {order.giftFrom && <span className="text-muted ml-1.5">From: {order.giftFrom}</span>}
            {order.giftMessage && <p className="text-secondary mt-0.5 italic">"{order.giftMessage}"</p>}
          </div>
        </div>
      )}

      {/* Buyer info */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Buyer</p>
        <div className="flex items-start gap-2 text-sm text-secondary">
          <User className="w-4 h-4 text-muted shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {order.customer
                ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') || order.customer.email
                : 'Guest'}
            </p>
            {order.customer?.email && <p className="text-muted text-xs">{order.customer.email}</p>}
          </div>
        </div>
      </div>

      {/* Delivery address */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Delivery address</p>
        <div className="flex items-start gap-2 text-sm text-secondary">
          <MapPin className="w-4 h-4 text-muted shrink-0 mt-0.5" />
          <div>
            {address.fullName && <p className="font-medium">{address.fullName}</p>}
            <p className="text-muted">{address.addressLine1}</p>
            {address.addressLine2 && <p className="text-muted">{address.addressLine2}</p>}
            <p className="text-muted">
              {address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}
            </p>
            <p className="text-muted">{address.country}</p>
          </div>
        </div>
      </div>

      {/* Private note */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Private note</p>
        <p className="text-xs text-muted mb-2">Only visible to you. Not shared with the buyer.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a private note about this order…"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
        />
        <button
          type="button"
          onClick={saveNote}
          disabled={savingNote}
          className={[
            'mt-1.5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-button transition-colors',
            noteSaved ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary-dark disabled:opacity-50',
          ].join(' ')}
        >
          {noteSaved ? <><Check className="w-3 h-3" /> Saved</> : <><Save className="w-3 h-3" /> {savingNote ? 'Saving…' : 'Save note'}</>}
        </button>
      </div>

      {/* Tracking */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Shipping
        </p>
        {order.shippingMethod?.name && (
          <p className="text-sm text-muted mb-2">{order.shippingMethod.name}</p>
        )}
        <div className="flex gap-2">
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="px-2 py-1.5 text-xs border border-border rounded-button bg-background text-secondary focus:outline-none focus:ring-1 focus:ring-primary/30 shrink-0"
          >
            {PRESET_CARRIERS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Tracking number"
            className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-border rounded-button bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono"
          />
          <button
            type="button"
            onClick={saveTracking}
            disabled={savingTrk || !tracking || (carrier === 'Other' && !customCarrier.trim())}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-button hover:bg-primary-dark disabled:opacity-50 shrink-0"
          >
            <Save className="w-3 h-3" />
            {savingTrk ? '…' : 'Save'}
          </button>
        </div>
        {carrier === 'Other' && (
          <input
            value={customCarrier}
            onChange={(e) => setCustomCarrier(e.target.value)}
            placeholder="Carrier name (e.g. Ninja Van, J&T, Vietnam Post…)"
            className="mt-1.5 w-full px-3 py-1.5 text-xs border border-border rounded-button bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        )}
        {tracking && trackingUrl && (
          <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
            className="mt-1.5 flex items-center gap-1.5 text-xs text-primary hover:underline">
            <ExternalLink className="w-3 h-3" /> Track — {effectiveCarrier} {tracking}
          </a>
        )}
        {tracking && effectiveCarrier && !trackingUrl && (
          <p className="mt-1.5 text-xs text-muted">{effectiveCarrier} · {tracking}</p>
        )}
        {order.labelUrl && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700">
            <Check className="w-3 h-3" /> Label purchased
            <a href={order.labelUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">Print →</a>
          </div>
        )}
      </div>

      {/* Order total */}
      <div className="border-t border-border pt-4 space-y-1.5">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Receipt</p>
        {[
          { label: 'Subtotal', value: `$${Number(order.subtotal ?? 0).toFixed(2)}` },
          order.shippingAmount ? { label: 'Shipping', value: `$${Number(order.shippingAmount).toFixed(2)}` } : null,
          order.discountAmount ? { label: 'Discount', value: `-$${Number(order.discountAmount).toFixed(2)}`, negative: true } : null,
        ].filter(Boolean).map((r) => r && (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="text-muted">{r.label}</span>
            <span className={r.negative ? 'text-error font-medium' : 'text-secondary'}>{r.value}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold text-secondary border-t border-border pt-1.5 mt-1.5">
          <span>Total</span>
          <span>${Number(order.total).toFixed(2)}</span>
        </div>
      </div>

      {previewItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={() => setPreviewItem(null)}
        >
          <div className="bg-surface rounded-xl p-4 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-secondary mb-3">{previewItem.productName} — Customization</p>
            {previewItem.previewUrl && (
              <Image src={previewItem.previewUrl} alt="Preview" width={400} height={400} className="w-full rounded-lg" />
            )}
            <button className="mt-3 text-xs text-muted hover:text-secondary" onClick={() => setPreviewItem(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status changer — full control over all statuses ───────────────────────────

function StatusChanger({ order, onUpdate }: { order: OrderDetail; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const { alert } = useDialog();

  const update = async (status: string) => {
    if (status === order.status || saving) return;
    setSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.ORDER_STATUS(order.id), { status });
      onUpdate();
    } catch (err) {
      await alert((err as Error).message || 'Could not update order status.', { variant: 'error' });
    } finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-muted shrink-0">Status:</span>
      <div className="w-52">
        <StatusSelect value={order.status} onChange={update} />
      </div>
      {saving && <span className="text-xs text-muted shrink-0">Saving…</span>}
    </div>
  );
}

// ── Three-dot menu ─────────────────────────────────────────────────────────────

function ThreeDotMenu({ order, onCancel, onUpdate }: { order: OrderDetail; onCancel: () => void; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const { confirm, alert } = useDialog();

  const printInvoice = async () => {
    setOpen(false);
    try {
      const { url } = await api.get<{ url: string }>(API_ROUTES.ADMIN.ORDER_INVOICE(order.id));
      window.open(url, '_blank');
    } catch (err) {
      await alert((err as Error).message || 'Could not generate the invoice.', { variant: 'error' });
    }
  };

  const handleRefund = async () => {
    setOpen(false);
    // Soft warning only — digital orders aren't hard-blocked from refunding,
    // but a refund immediately revokes the buyer's download access (order
    // leaves COMPLETED), so make sure that's intentional before confirming.
    const message = order.isDigital
      ? 'This order contains non-refundable digital downloads. Refunding will immediately revoke the buyer\'s access to their files. Continue?'
      : 'Issue a full refund for this order?';
    if (!await confirm(message, { title: 'Issue Refund', confirmLabel: 'Issue Refund', destructive: true })) return;
    try {
      await api.post(API_ROUTES.ADMIN.ORDER_REFUND(order.id), { reason: 'Admin initiated' });
      onUpdate();
    } catch (err) {
      await alert((err as Error).message || 'Could not issue the refund.', { variant: 'error' });
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 hover:bg-muted/10 rounded-button transition-colors"
        aria-label="More actions"
      >
        <MoreVertical className="w-4 h-4 text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full right-0 mt-1 min-w-[180px] bg-surface border border-border rounded-xl shadow-xl py-1">
            <button onClick={printInvoice} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-secondary hover:bg-muted/8">
              <Printer className="w-4 h-4 text-muted" /> Print invoice
            </button>
            <button
              onClick={() => { setOpen(false); onCancel(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error/5"
            >
              <Ban className="w-4 h-4" /> Cancel order
            </button>
            <button onClick={handleRefund} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error/5">
              <DollarSign className="w-4 h-4" /> Refund order
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Cancel modal ───────────────────────────────────────────────────────────────

function CancelModal({ order, onClose, onDone }: { order: OrderDetail; onClose: () => void; onDone: () => void }) {
  const [reason,  setReason]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const { alert } = useDialog();

  const handleCancel = async () => {
    setSaving(true);
    try {
      await api.post(API_ROUTES.ADMIN.ORDER_CANCEL(order.id), { reason: reason || 'Cancelled by admin' });
      onDone();
      onClose();
    } catch (err) {
      await alert((err as Error).message || 'Could not cancel this order.', { variant: 'error' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-secondary text-lg mb-1">Cancel order</h3>
        <p className="text-sm text-muted mb-4">Order #{order.orderNumber} will be cancelled.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for cancellation (optional)"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted mb-4"
        />
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold border border-border rounded-button text-secondary hover:border-primary/40 transition-colors">
            Keep order
          </button>
          <button type="button" onClick={handleCancel} disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold bg-error text-white rounded-button hover:bg-error/90 disabled:opacity-50 transition-colors">
            {saving ? 'Cancelling…' : 'Cancel order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export interface OrderDetailPanelProps {
  order:    OrderDetail;
  onClose:  () => void;
  onUpdate: () => void;
}

type Tab = 'details' | 'earnings';

export function OrderDetailPanel({ order, onClose, onUpdate }: OrderDetailPanelProps) {
  const [tab, setTab]             = useState<Tab>('details');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [buyLabelOpen, setBuyLabelOpen] = useState(false);
  const [localLabelUrl, setLocalLabelUrl] = useState<string | null>(null);

  const labelUrl = localLabelUrl ?? order.labelUrl ?? null;

  const handleLabelPurchased = (result: LabelPurchaseResult) => {
    setLocalLabelUrl(result.labelUrl);
    onUpdate();
  };

  // Parse shipping address for BuyLabelModal
  const shippingAddr = (() => {
    try { return JSON.parse(order.shippingAddress as string) as Record<string, string>; }
    catch { return {} as Record<string, string>; }
  })();

  // Escape key
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && !cancelOpen) onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose, cancelOpen]);

  const customerName = order.customer
    ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') || order.customer.email
    : 'Guest';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[40] bg-black/20" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.orderNumber}`}
        className="fixed right-0 top-0 bottom-0 z-[50] w-[520px] max-w-[96vw] bg-surface shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-start justify-between mb-1">
            <div className="min-w-0 flex-1 mr-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-secondary font-mono text-base">#{order.orderNumber}</span>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="text-xs text-muted mt-0.5">
                {customerName} · {fmtDate(order.createdAt)} · ${Number(order.total).toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ThreeDotMenu order={order} onCancel={() => setCancelOpen(true)} onUpdate={onUpdate} />
              <button type="button" onClick={onClose} className="p-1.5 hover:bg-muted/10 rounded-full transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
          </div>

          {/* Status changer + label actions */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <StatusChanger order={order} onUpdate={onUpdate} />
            {!labelUrl ? (
              <button
                type="button"
                onClick={() => setBuyLabelOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary border border-primary/30 hover:bg-primary/5 rounded-button transition-colors"
              >
                <Truck className="w-3.5 h-3.5" /> Buy label
              </button>
            ) : (
              <a href={labelUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 border border-green-300 hover:bg-green-50 rounded-button transition-colors">
                <Truck className="w-3.5 h-3.5" /> Print label
              </a>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-3 border-b border-border -mb-[1px]">
            {(['details', 'earnings'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  'px-4 py-2 text-sm font-semibold border-b-2 transition-colors',
                  tab === t
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-secondary',
                ].join(' ')}
              >
                {t === 'details' ? 'Order details' : 'Earnings'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === 'details' ? (
            <OrderDetailsTab order={order} onUpdate={onUpdate} />
          ) : (
            <EarningsTab orderId={order.id} />
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-border bg-background flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => window.open(`/messages?orderId=${order.id}`, '_blank')}
            className="flex items-center gap-1.5 text-xs font-medium text-secondary border border-border hover:border-primary/40 px-3 py-2 rounded-button transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Message buyer
          </button>
          <button
            type="button"
            onClick={() => window.open(`mailto:${order.customer?.email}`, '_blank')}
            className="flex items-center gap-1.5 text-xs font-medium text-secondary border border-border hover:border-primary/40 px-3 py-2 rounded-button transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Email buyer
          </button>
        </div>
      </aside>

      {/* Cancel modal */}
      {cancelOpen && (
        <CancelModal
          order={order}
          onClose={() => setCancelOpen(false)}
          onDone={() => { onUpdate(); onClose(); }}
        />
      )}

      {/* Buy label modal */}
      <BuyLabelModal
        orderId={order.id}
        shippingName={shippingAddr['fullName'] ?? order.customer?.firstName ?? ''}
        shippingCity={shippingAddr['city'] ?? ''}
        shippingState={shippingAddr['state']}
        shippingCountry={shippingAddr['country'] ?? 'US'}
        isOpen={buyLabelOpen}
        onClose={() => setBuyLabelOpen(false)}
        onLabelPurchased={handleLabelPurchased}
      />
    </>
  );
}
