'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { formatCapturedUsd, MoneyMode } from '../../lib/economic-finances';

interface VerifiedSummary {
  version: 'economic-v1'; provenance: MoneyMode; currency: 'USD'; minorExponent: 2;
  readOnly: true; basis: 'IMMUTABLE_VERIFIED_EVIDENCE'; legacyIncluded: false;
  capturedMinor: string; refundedMinor: string; netCollectedMinor: string;
  paidOutMinor: string; outstandingDebtMinor: string; recoveredDebtMinor: string;
  bookedRefundRoundingMinor: string;
  actualProviderFeeMinor: null; actualShippingCostMinor: null;
  downstream?: { lifecycleAppliedCount: number; notificationProjectionCount: number; podVerifiedCount: number;
    externalUnknownCount: number; smtpAcceptedCount: number; smtpBasis: 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY' };
}
const control = 'min-h-11 rounded-button border border-border bg-surface px-3 py-2 text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';

export function EconomicSummaryPanel({ actorId }: { actorId: string }) {
  const [mode, setMode] = useState<MoneyMode>('LIVE');
  const report = useQuery({ queryKey: ['economic-summary', actorId, 'platform', mode],
    queryFn: () => api.get<VerifiedSummary>('/admin/economic-finances/summary', { params: { provenance: mode, currency: 'USD' } }), retry: false });
  const data = report.data;
  const valid = data?.version === 'economic-v1' && data.provenance === mode && data.currency === 'USD'
    && data.minorExponent === 2 && data.readOnly === true && data.basis === 'IMMUTABLE_VERIFIED_EVIDENCE'
    && data.legacyIncluded === false && data.actualProviderFeeMinor === null && data.actualShippingCostMinor === null
    && [data.capturedMinor, data.refundedMinor, data.netCollectedMinor, data.paidOutMinor, data.outstandingDebtMinor, data.recoveredDebtMinor]
      .every(value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value))
    && typeof data.bookedRefundRoundingMinor === 'string' && /^(0|-?[1-9]\d*)$/.test(data.bookedRefundRoundingMinor);
  return <section aria-labelledby="verified-summary-heading" className="space-y-4 text-secondary">
    <h2 id="verified-summary-heading" className="text-xl font-semibold">Verified money totals</h2>
    <p>Only independently verified captures, completed refunds and payout settlements. Legacy records are excluded. Net collected is not profit or a bank balance.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor="summary-mode" className="flex flex-col gap-2">Money environment
        <select id="summary-mode" className={control} value={mode} onChange={event => setMode(event.target.value as MoneyMode)}>
          <option value="LIVE">Live</option><option value="TEST">Test / sandbox</option>
        </select>
      </label>
      <button type="button" className={control} disabled={report.isFetching} onClick={() => void report.refetch()}>Refresh verified totals</button>
    </div>
    <p className="font-semibold">{mode === 'LIVE' ? 'LIVE — production records only' : 'TEST — sandbox records only'}</p>
    <div role="status" aria-live="polite">{report.isFetching ? 'Loading verified totals…' : ''}</div>
    {(report.isError || (data && !valid)) && <div role="alert" className="rounded-card border border-error p-4 space-y-3">
      <p>Verified totals could not be loaded. No balances have been assumed.</p>
      <button type="button" className={control} disabled={report.isFetching} onClick={() => void report.refetch()}>Retry verified totals</button>
    </div>}
    {valid && !report.isError && !report.isFetching && <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[
        ['Captured', data.capturedMinor], ['Completed refunds', data.refundedMinor], ['Net collected', data.netCollectedMinor],
        ['Settled payouts', data.paidOutMinor], ['Outstanding refund debt', data.outstandingDebtMinor], ['Debt retained / recovered', data.recoveredDebtMinor],
        ['Booked refund rounding (signed)', data.bookedRefundRoundingMinor],
      ].map(([label, value]) => <div key={label} className="min-w-0 rounded-card border border-border bg-surface p-4">
        <dt>{label}</dt><dd className="mt-2 font-semibold tabular-nums [overflow-wrap:anywhere]">{formatCapturedUsd(value)}</dd>
      </div>)}
      {['Actual provider fees', 'Actual shipping spend'].map(label => <div key={label} className="rounded-card border border-border p-4">
        <dt>{label}</dt><dd className="mt-2">Unknown — no verified cost receipt</dd>
      </div>)}
    </dl>}
    {valid && !report.isError && !report.isFetching && data.downstream
      && data.downstream.smtpBasis === 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY'
      && [data.downstream.lifecycleAppliedCount, data.downstream.notificationProjectionCount, data.downstream.podVerifiedCount,
        data.downstream.externalUnknownCount, data.downstream.smtpAcceptedCount].every(value => Number.isSafeInteger(value) && value >= 0)
      && <div className="rounded-card border border-border p-4 space-y-2">
        <h3 className="font-semibold">Verified downstream processing</h3>
        <p>Lifecycle effects applied: {data.downstream.lifecycleAppliedCount}. Notification projections: {data.downstream.notificationProjectionCount}.</p>
        <p>Original POD creations verified: {data.downstream.podVerifiedCount}. Unknown external outcomes: {data.downstream.externalUnknownCount}.</p>
        <p>SMTP accepted: {data.downstream.smtpAcceptedCount}. Inbox delivery, production and shipping spend are not implied by these counts.</p>
      </div>}
  </section>;
}
