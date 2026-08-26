'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Copy, Check, ExternalLink, CreditCard,
  RotateCcw, AlertCircle, Gift,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtFixed, fmtDate, fmtDateTime } from '../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type PaymentMethod = 'STRIPE' | 'PAYPAL' | 'GIFT_CARD' | 'MIXED';

export interface PaymentRecord {
  id:                      string;
  orderId:                 string;
  orderNumber:             string;
  customerName:            string;
  customerEmail:           string;
  method:                  PaymentMethod;
  status:                  PaymentStatus;
  amount:                  number;
  currency:                string;
  stripePaymentIntentId?:  string;
  stripeChargeId?:         string;
  paypalOrderId?:          string;
  paypalCaptureId?:        string;
  giftCardCode?:           string;
  giftCardAmount?:         number;
  refundedAmount:          number;
  paidAt?:                 string;
  createdAt:               string;
  cardBrand?:              string;
  cardLast4?:              string;
}

interface Refund {
  id:        string;
  amount:    number;
  reason?:   string;
  createdAt: string;
}

// ── Status badge (local) ──────────────────────────────────────────────────────

const STATUS_CFG: Record<PaymentStatus, { label: string; cls: string }> = {
  PENDING:              { label: 'Pending',          cls: 'bg-yellow-100 text-yellow-700' },
  PAID:                 { label: 'Paid',             cls: 'bg-green-100 text-green-700'   },
  FAILED:               { label: 'Failed',           cls: 'bg-red-100 text-red-700'       },
  REFUNDED:             { label: 'Refunded',         cls: 'bg-gray-100 text-gray-600'     },
  PARTIALLY_REFUNDED:   { label: 'Partial Refund',   cls: 'bg-orange-100 text-orange-700' },
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const { label, cls } = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-semibold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

// ── Method icon ───────────────────────────────────────────────────────────────

const METHOD_CFG: Record<PaymentMethod, { label: string; bg: string; text: string }> = {
  STRIPE:    { label: 'Stripe',    bg: 'bg-[#635BFF]/10', text: 'text-[#635BFF]'  },
  PAYPAL:    { label: 'PayPal',    bg: 'bg-blue-50',       text: 'text-blue-600'   },
  GIFT_CARD: { label: 'Gift Card', bg: 'bg-pink-50',       text: 'text-pink-600'   },
  MIXED:     { label: 'Mixed',     bg: 'bg-purple-50',     text: 'text-purple-600' },
};

function MethodPill({ method }: { method: PaymentMethod }) {
  const { label, bg, text } = METHOD_CFG[method] ?? { label: method, bg: 'bg-gray-50', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-semibold ${bg} ${text}`}>
      <CreditCard className="w-3 h-3 opacity-70" />
      {label}
    </span>
  );
}

// ── Copy-to-clipboard ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy to clipboard"
      className="p-1 rounded hover:bg-muted/10 text-muted hover:text-secondary transition-colors shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted w-28 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-right">{children}</div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-background rounded-card border border-border p-4 space-y-0.5">
      <h5 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {title}
      </h5>
      {children}
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

interface PaymentDetailDrawerProps {
  payment: PaymentRecord;
  onClose:  () => void;
  onRefund?: () => void;
}

export function PaymentDetailDrawer({ payment, onClose, onRefund }: PaymentDetailDrawerProps) {
  const qc = useQueryClient();

  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [refundError,  setRefundError]  = useState<string | null>(null);
  const [refundDone,   setRefundDone]   = useState(false);

  const maxRefund = payment.amount - payment.refundedAmount;
  const canRefund = payment.status === 'PAID' || payment.status === 'PARTIALLY_REFUNDED';

  // Fetch previous refunds
  const { data: refunds = [] } = useQuery<Refund[]>({
    queryKey: ['payment-refunds', payment.id],
    queryFn:  () => api.get<Refund[]>(API_ROUTES.ADMIN.PAYMENT_REFUNDS(payment.id)),
    enabled: canRefund,
  });

  const handleRefund = async () => {
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0)     { setRefundError('Enter a valid amount'); return; }
    if (amt > maxRefund)             { setRefundError(`Max refundable: ${fmtAmount(maxRefund)}`); return; }

    setSubmitting(true);
    setRefundError(null);
    try {
      await api.post(API_ROUTES.ADMIN.PAYMENT_REFUND(payment.id), { amount: amt, reason: refundReason || undefined });
      setRefundDone(true);
      setRefundAmount('');
      setRefundReason('');
      qc.invalidateQueries({ queryKey: ['payment-refunds', payment.id] });
      qc.invalidateQueries({ queryKey: ['admin-payments'] });
      qc.invalidateQueries({ queryKey: ['payment-stats'] });
      onRefund?.();
      setTimeout(() => setRefundDone(false), 4000);
    } catch (e: unknown) {
      setRefundError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const cardLabel = payment.cardBrand && payment.cardLast4
    ? `${payment.cardBrand} ending ${payment.cardLast4}`
    : payment.method === 'PAYPAL'
      ? 'PayPal'
      : payment.method === 'GIFT_CARD'
        ? 'Gift Card'
        : 'Card';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[480px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-secondary truncate">
              Payment for <span className="font-mono">#{payment.orderNumber}</span>
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={payment.status} />
              <MethodPill  method={payment.method} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors shrink-0 ml-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Payment info */}
          <Section title="Payment Info" icon={CreditCard}>
            <InfoRow label="Method">
              <span className="text-sm font-medium text-secondary">{cardLabel}</span>
            </InfoRow>
            <InfoRow label="Amount">
              <span className="text-lg font-bold text-secondary tabular-nums">
                {fmtAmount(payment.amount)}
                <span className="text-xs font-normal text-muted ml-1">{payment.currency}</span>
              </span>
            </InfoRow>
            {payment.refundedAmount > 0 && (
              <InfoRow label="Refunded">
                <span className="text-sm font-semibold text-orange-600 tabular-nums">
                  −{fmtAmount(payment.refundedAmount)}
                </span>
              </InfoRow>
            )}
            {payment.stripeChargeId && (
              <InfoRow label="Charge ID">
                <div className="flex items-center justify-end gap-1">
                  <code className="text-xs font-mono text-muted bg-background border border-border px-2 py-0.5 rounded">
                    {payment.stripeChargeId}
                  </code>
                  <CopyButton text={payment.stripeChargeId} />
                </div>
              </InfoRow>
            )}
            {payment.stripePaymentIntentId && (
              <InfoRow label="Intent ID">
                <div className="flex items-center justify-end gap-1">
                  <code className="text-xs font-mono text-muted bg-background border border-border px-2 py-0.5 rounded truncate max-w-[180px]">
                    {payment.stripePaymentIntentId}
                  </code>
                  <CopyButton text={payment.stripePaymentIntentId} />
                </div>
              </InfoRow>
            )}
            {payment.paypalCaptureId && (
              <InfoRow label="PayPal Capture">
                <div className="flex items-center justify-end gap-1">
                  <code className="text-xs font-mono text-muted bg-background border border-border px-2 py-0.5 rounded truncate max-w-[180px]">
                    {payment.paypalCaptureId}
                  </code>
                  <CopyButton text={payment.paypalCaptureId} />
                </div>
              </InfoRow>
            )}
            <InfoRow label="Date">
              <span className="text-sm text-muted">
                {fmtDateTime(payment.paidAt ?? payment.createdAt)}
              </span>
            </InfoRow>
            <InfoRow label="Customer">
              <div className="text-right">
                <p className="text-sm font-medium text-secondary">{payment.customerName}</p>
                <p className="text-xs text-muted">{payment.customerEmail}</p>
              </div>
            </InfoRow>
          </Section>

          {/* Gift card section */}
          {(payment.giftCardCode || payment.method === 'GIFT_CARD' || payment.method === 'MIXED') && (
            <Section title="Gift Card Applied" icon={Gift}>
              <InfoRow label="Code">
                <div className="flex items-center justify-end gap-1">
                  <code className="text-xs font-mono font-semibold text-pink-600 tracking-widest">
                    {payment.giftCardCode ?? '—'}
                  </code>
                  {payment.giftCardCode && <CopyButton text={payment.giftCardCode} />}
                </div>
              </InfoRow>
              <InfoRow label="Amount Applied">
                <span className="text-sm font-bold text-pink-600 tabular-nums">
                  {fmtAmount(payment.giftCardAmount)}
                </span>
              </InfoRow>
              {(payment.method === 'MIXED') && (
                <InfoRow label="Stripe Charge">
                  <span className="text-sm font-medium text-secondary tabular-nums">
                    {fmtAmount((payment.amount ?? 0) - (payment.giftCardAmount ?? 0))}
                  </span>
                </InfoRow>
              )}
            </Section>
          )}

          {/* Refund section */}
          {canRefund && (
            <Section title="Issue Refund" icon={RotateCcw}>
              {maxRefund > 0 ? (
                <div className="space-y-3 mt-1">
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                      Amount to Refund
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                      <input
                        type="number"
                        min={0.01}
                        max={maxRefund}
                        step={0.01}
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
                        placeholder={`Max ${fmtAmount(maxRefund)}`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted">Max: ${fmtFixed(maxRefund, 2)}</p>
                      <button
                        type="button"
                        onClick={() => setRefundAmount(fmtFixed(maxRefund, 2))}
                        className="text-xs text-primary hover:underline"
                      >
                        Full refund
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                      Reason <span className="font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      rows={2}
                      placeholder="e.g. Customer request, damaged item…"
                      className="w-full px-3 py-2 text-sm border border-border rounded-button bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
                    />
                  </div>

                  {refundError && (
                    <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {refundError}
                    </div>
                  )}

                  {refundDone && (
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-button px-3 py-2">
                      <Check className="w-3.5 h-3.5" />
                      Refund issued successfully.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleRefund}
                    disabled={submitting || !refundAmount}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-red-600 border-2 border-red-200 hover:bg-red-50 rounded-button transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                    {submitting ? 'Processing…' : 'Issue Refund'}
                  </button>

                  <p className="text-[11px] text-muted text-center">
                    Note: Gift card payments are refunded to gift card balance, not cash.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted py-2">This payment has been fully refunded.</p>
              )}

              {/* Previous refunds */}
              {refunds.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">Previous Refunds</p>
                  {refunds.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-secondary tabular-nums">−${fmtFixed(r.amount, 2)}</span>
                        {r.reason && <span className="text-muted ml-1.5">· {r.reason}</span>}
                      </div>
                      <span className="text-muted">{fmtDate(r.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Order link */}
          <Link
            href={`/orders/${payment.orderId}`}
            className="flex items-center justify-between w-full px-4 py-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-button transition-colors group"
          >
            <span className="text-sm font-semibold text-primary">
              View Order <span className="font-mono">#{payment.orderNumber}</span>
            </span>
            <ExternalLink className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </>
  );
}
