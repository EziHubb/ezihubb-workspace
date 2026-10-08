'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { EconomicOrderPanelEarnings, OrderPanelEarnings } from './types';
import { formatCapturedUsd } from '../../../lib/economic-finances';

/**
 * What this shop earned on this order.
 *
 * Versioned money reads immutable shop capture/refund allocations. Historical
 * ledger data is a separate, explicitly unknown-provenance projection. Neither
 * is profit or an available payout balance; no current fee rules are re-run.
 */

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;
const signed = (n: number) => (n < 0 ? `-${money(n)}` : money(n));

interface Props {
  storeOrderId: string;
  data:    OrderPanelEarnings | undefined;
  loading: boolean;
  error:   string | null;
}

export function OrderEarningsTab({ data, loading, error, storeOrderId }: Props) {
  const [showPaid, setShowPaid] = useState(false);
  const [showFees, setShowFees] = useState(false);

  if (loading) {
    return (
      <div role="status" className="flex items-center gap-2 py-16 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading earnings…
      </div>
    );
  }

  // Said out loud rather than rendered as zeroes. A failed request that looks
  // like "you earned nothing" is worse than no answer at all.
  if (error || !data) {
    return <p role="alert" className="py-16 text-sm text-error">Could not load earnings. {error}</p>;
  }

  if (data.version === 'economic-v1') {
    if (!validEconomicEarnings(data, storeOrderId)) return <p role="alert" className="py-8 text-sm text-error">
      Shop allocation evidence could not be verified. Refresh the order or ask support to reconcile it. No historical ledger fallback is shown.
    </p>;
    return <EconomicEarnings data={data} />;
  }
  if (data.version !== 'legacy-ledger' || data.financeReporting?.classification !== 'LEGACY_UNKNOWN'
    || data.financeReporting.versionedFundsIncluded !== false || data.financeReporting.requiresReconciliation !== true
    || data.includedInAvailable !== false || !Array.isArray(data.fees?.lines)
    || typeof data.pending !== 'boolean'
    || [data.youEarned, data.fees.total, data.buyerPaid?.total, data.buyerPaid?.itemsPrice, data.buyerPaid?.postage,
      data.buyerPaid?.shippingSubsidy, data.buyerPaid?.discount, data.buyerPaid?.subtotal]
      .some(value => !Number.isFinite(value)) || data.fees.lines.some(line => !line || typeof line.label !== 'string'
        || typeof line.type !== 'string' || !Number.isFinite(line.amount))) {
    return <p role="alert" className="py-8 text-sm text-error">Historical earnings data could not be verified. Refresh the order or contact support.</p>;
  }

  if (data.pending) {
    return (
      <p className="py-16 text-sm text-muted">
        LEGACY_UNKNOWN · No historical ledger entries have been posted. This does not establish whether money was captured.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-card border border-border p-3 text-sm text-muted">LEGACY_UNKNOWN · Historical ledger only. Not verified captured funds, profit or available cash.</p>
      <p className="text-xl text-secondary">
        Historical ledger net{' '}
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

const minor = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9]\d{0,18})$/.test(value)
  && BigInt(value) <= BigInt('9223372036854775807');
function validEconomicEarnings(value: EconomicOrderPanelEarnings, storeOrderId: string) {
  if (value.storeOrderId !== storeOrderId || typeof value.storeId !== 'string' || !value.storeId
    || typeof value.orderId !== 'string' || !value.orderId
    || !['LIVE', 'TEST'].includes(value.provenance) || value.currency !== 'USD' || value.minorExponent !== 2
    || value.basis !== 'IMMUTABLE_VERIFIED_SHOP_ALLOCATION' || value.legacyIncluded !== false || value.readOnly !== true
    || value.profitMinor !== null || value.actualProviderCostMinor !== null || value.actualShippingCostMinor !== null
    || value.taxBasis !== 'ORDER_LEVEL_TAX_NOT_ALLOCATED_TO_SHOP' || !Number.isSafeInteger(value.pendingRefundCount)
    || value.pendingRefundCount < 0 || !Array.isArray(value.feeLines)) return false;
  if (value.state === 'AWAITING_CAPTURE') return value.captureId === null && value.amounts === null && value.feeLines.length === 0 && value.pendingRefundCount === 0;
  const amounts = value.amounts;
  if (value.state !== 'CAPTURE_VERIFIED' || typeof value.captureId !== 'string' || !value.captureId || !amounts) return false;
  const keys: (keyof NonNullable<EconomicOrderPanelEarnings['amounts']>)[] = ['customerCapturedMinor', 'customerRefundedMinor',
    'netCustomerCollectedMinor', 'platformFundingMinor', 'sellerGrossMinor', 'sellerAllocatedMinor', 'sellerReversedMinor',
    'netSellerAllocationMinor', 'sellerFeeMinor', 'reversedFeeMinor', 'netFeeMinor', 'paidMinor', 'reservedMinor', 'debtRecoveredMinor'];
  if (keys.some(key => !minor(amounts[key])) || value.feeLines.some(line => !line || typeof line.code !== 'string'
    || typeof line.ruleReference !== 'string' || !minor(line.capturedMinor) || !minor(line.reversedMinor) || !minor(line.netMinor)
    || BigInt(line.capturedMinor) - BigInt(line.reversedMinor) !== BigInt(line.netMinor))) return false;
  return BigInt(amounts.customerCapturedMinor) - BigInt(amounts.customerRefundedMinor) === BigInt(amounts.netCustomerCollectedMinor)
    && BigInt(amounts.sellerAllocatedMinor) - BigInt(amounts.sellerReversedMinor) === BigInt(amounts.netSellerAllocationMinor)
    && BigInt(amounts.sellerFeeMinor) - BigInt(amounts.reversedFeeMinor) === BigInt(amounts.netFeeMinor)
    && BigInt(amounts.customerCapturedMinor) + BigInt(amounts.platformFundingMinor) === BigInt(amounts.sellerGrossMinor)
    && BigInt(amounts.sellerAllocatedMinor) + BigInt(amounts.sellerFeeMinor) === BigInt(amounts.sellerGrossMinor)
    && BigInt(amounts.paidMinor) + BigInt(amounts.reservedMinor) + BigInt(amounts.debtRecoveredMinor) <= BigInt(amounts.sellerAllocatedMinor);
}

function EconomicEarnings({ data }: { data: EconomicOrderPanelEarnings }) {
  const amounts = data.amounts;
  return <section aria-label="Verified shop allocations" className="space-y-4">
    <p className="rounded-card border border-border p-3 text-sm text-secondary">
      {data.provenance === 'TEST' ? 'TEST · Simulation, not live money.' : 'LIVE · Verified original capture and settled refunds.'}
      {' '}This shop only; no other shop amounts or order-level tax are included.
    </p>
    {data.state === 'AWAITING_CAPTURE' || !amounts ? <p role="status" className="py-6 text-sm text-muted">
      No verified capture yet. A checkout total or paid status is not evidence of collected funds.
    </p> : <>
      <p className="text-xl text-secondary">Net seller allocation after refunds{' '}
        <span className="font-semibold tabular-nums">{formatCapturedUsd(amounts.netSellerAllocationMinor)}</span></p>
      <div className="space-y-3 rounded-card border border-border bg-surface p-4">
        <Row label="Customer captured for this shop" value={formatCapturedUsd(amounts.customerCapturedMinor)} />
        <Row label="Verified customer refunds" value={formatCapturedUsd(amounts.customerRefundedMinor)} />
        <Row label="Net customer collected" value={formatCapturedUsd(amounts.netCustomerCollectedMinor)} strong divider />
        <Row label="Original platform promotion funding" value={formatCapturedUsd(amounts.platformFundingMinor)} />
        <Row label="Original seller allocation" value={formatCapturedUsd(amounts.sellerAllocatedMinor)} />
        <Row label="Verified seller allocation reversals" value={formatCapturedUsd(amounts.sellerReversedMinor)} />
        <Row label="Paid to seller from original lots" value={formatCapturedUsd(amounts.paidMinor)} />
        <Row label="Reserved for payout" value={formatCapturedUsd(amounts.reservedMinor)} />
        <Row label="Applied to prior debt recovery" value={formatCapturedUsd(amounts.debtRecoveredMinor)} />
      </div>
      <section aria-label="Original fee allocation" className="space-y-3 rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold text-secondary">Original fees after verified reversals</h3>
        <Row label="Original fee allocation" value={formatCapturedUsd(amounts.sellerFeeMinor)} />
        <Row label="Reversed fee allocation" value={formatCapturedUsd(amounts.reversedFeeMinor)} />
        <Row label="Net fee allocation" value={formatCapturedUsd(amounts.netFeeMinor)} strong />
        {data.feeLines.map(line => <Row key={`${line.code}:${line.ruleReference}`} label={`${line.code} (${line.ruleReference})`}
          value={formatCapturedUsd(line.netMinor)} />)}
        <p className="text-sm text-muted">Original rules only. Component rounding can differ from the aggregate refund fee allocation.</p>
      </section>
      {data.pendingRefundCount > 0 && <p role="status" className="text-sm text-secondary">
        {data.pendingRefundCount} refund request(s) awaiting verified settlement. Not deducted as completed refunds.
      </p>}
      <p className="text-sm text-muted">This is not profit or withdrawable cash. Provider and shipping costs are not yet verified.
        {' '}Account-level holds, refund debt and payout availability must be reviewed in Finances.</p>
    </>}
  </section>;
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
    <section aria-label={label} className="rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
      <span className={`min-w-0 break-words text-sm ${strong ? 'font-semibold text-secondary' : 'text-secondary'}`}>{label}</span>
      <span className={`shrink-0 text-sm tabular-nums ${
        negative ? 'text-error' : strong ? 'font-semibold text-secondary' : 'text-secondary'
      }`}>
        {value}
      </span>
    </div>
  );
}
