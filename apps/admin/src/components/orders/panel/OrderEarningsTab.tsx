'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { OrderPanelEarnings } from './types';

/**
 * What this shop earned on this order.
 *
 * Every number comes from the shop's own ledger, which is what the payout is
 * batched from — so the fee lines here are the ones actually charged, not a
 * fee schedule re-run at read time that would drift the moment platform rates
 * change.
 */

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;
const signed = (n: number) => (n < 0 ? `-${money(n)}` : money(n));

interface Props {
  data:    OrderPanelEarnings | undefined;
  loading: boolean;
  error:   string | null;
}

export function OrderEarningsTab({ data, loading, error }: Props) {
  const [showPaid, setShowPaid] = useState(false);
  const [showFees, setShowFees] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading earnings…
      </div>
    );
  }

  // Said out loud rather than rendered as zeroes. A failed request that looks
  // like "you earned nothing" is worse than no answer at all.
  if (error || !data) {
    return <p className="py-16 text-sm text-error">Could not load earnings. {error}</p>;
  }

  if (data.pending) {
    return (
      <p className="py-16 text-sm text-muted">
        Earnings appear once this order is paid for.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xl text-secondary">
        You earned{' '}
        <span className={data.youEarned >= 0 ? 'font-semibold text-success' : 'font-semibold text-error'}>
          {signed(data.youEarned)}
        </span>{' '}
        on this order
      </p>

      <Card
        label="Buyer paid"
        amount={money(data.buyerPaid.total)}
        open={showPaid}
        onToggle={() => setShowPaid((v) => !v)}
      >
        <Row label="Item(s) price" value={money(data.buyerPaid.itemsPrice)} />
        <Row label="Postage price" value={money(data.buyerPaid.postage)} />
        {data.buyerPaid.shippingSubsidy > 0 && (
          <Row
            label="Platform shipping support"
            value={`-${money(data.buyerPaid.shippingSubsidy)}`}
            negative
          />
        )}
        {data.buyerPaid.discount > 0 && (
          <Row
            label={data.buyerPaid.couponCode ? `Shop discount (${data.buyerPaid.couponCode})` : 'Shop discount'}
            value={`-${money(data.buyerPaid.discount)}`}
            negative
          />
        )}
        <Row label="Subtotal" value={money(data.buyerPaid.subtotal)} divider />
        <Row label="Order total" value={money(data.buyerPaid.total)} strong />
      </Card>

      <Card
        label="Fees & credits"
        amount={signed(data.fees.total)}
        amountNegative={data.fees.total < 0}
        open={showFees}
        onToggle={() => setShowFees((v) => !v)}
      >
        {data.fees.lines.length === 0 ? (
          <p className="py-1 text-sm text-muted">No fees were charged on this order.</p>
        ) : (
          data.fees.lines.map((line, i) => (
            // Keyed by type + index: a shop can be charged the same fee type
            // twice on one order (an adjustment posted later), and keying on
            // type alone would collapse the two into one row.
            <Row
              key={`${line.type}-${i}`}
              label={line.label}
              value={signed(line.amount)}
              negative={line.amount < 0}
            />
          ))
        )}
      </Card>
    </div>
  );
}

function Card({
  label, amount, amountNegative, open, onToggle, children,
}: {
  label: string;
  amount: string;
  amountNegative?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
      >
        <span className="font-semibold text-secondary">{label}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted" aria-hidden="true" />
          : <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />}
        <span className={`ml-auto font-semibold ${amountNegative ? 'text-error' : 'text-secondary'}`}>
          {amount}
        </span>
      </button>
      {open && <div className="space-y-1.5 border-t border-border px-4 py-3">{children}</div>}
    </section>
  );
}

function Row({
  label, value, negative, strong, divider,
}: {
  label: string; value: string; negative?: boolean; strong?: boolean; divider?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${divider ? 'border-t border-border pt-2' : ''}`}>
      <span className={`text-sm ${strong ? 'font-semibold text-secondary' : 'text-secondary'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${
        negative ? 'text-error' : strong ? 'font-semibold text-secondary' : 'text-secondary'
      }`}>
        {value}
      </span>
    </div>
  );
}
