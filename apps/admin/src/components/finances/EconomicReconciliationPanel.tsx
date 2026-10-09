'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { formatCapturedUsd, MoneyMode, ReconciliationHistory } from '../../lib/economic-finances';
import { EconomicRefundWorkflow } from './EconomicRefundWorkflow';
import { Badge, Button, Input, Pagination, Select } from '@ezihubb/ui';

const states = ['PREPARED', 'DISPATCHED', 'NEEDS_RECONCILIATION', 'SUCCEEDED', 'FAILED'] as const;
type Filters = { provenance: MoneyMode; state: string; kind: string; reference: string; storeId: string };
const initialFilters: Filters = { provenance: 'LIVE', state: '', kind: '', reference: '', storeId: '' };

/** Read-only report; original refund actions use a separate, gated confirmation workflow. */
export function EconomicReconciliationPanel({ actorId }: { actorId: string }) {
  const [filters, setFilters] = useState(initialFilters);
  const [draftReference, setDraftReference] = useState(''), [draftStore, setDraftStore] = useState('');
  const [page, setPage] = useState(1);
  function change(next: Partial<Filters>) { setFilters(previous => ({ ...previous, ...next })); setPage(1); }
  const report = useQuery({
    queryKey: ['economic-reconciliation', actorId, 'platform', filters, page],
    queryFn: () => api.get<ReconciliationHistory>('/admin/economic-finances/reconciliation', { params: {
      provenance: filters.provenance, currency: 'USD', page, limit: 20,
      ...(filters.state ? { state: filters.state } : {}), ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.reference ? { reference: filters.reference } : {}), ...(filters.storeId ? { storeId: filters.storeId } : {}),
    } }),
    retry: false,
  });
  const data = report.data;
  // Never show cached amounts under a different mode or an incompatible contract.
  const valid = data?.readOnly === true && data.version === 'economic-v1'
    && data.provenance === filters.provenance && data.currency === 'USD'
    && Array.isArray(data.data) && data.data.every(row => row.currency === 'USD' && row.minorExponent === 2 && row.provenance === filters.provenance
      && /^\d+$/.test(row.expectedMinor) && (row.verifiedMinor === null || /^\d+$/.test(row.verifiedMinor))
      && (row.differenceMinor === null || /^-?\d+$/.test(row.differenceMinor))
      && (row.refundRequest === null || /^(0|-?[1-9]\d*)$/.test(row.refundRequest?.platformRoundingMinor)));
  const rows = valid && !report.isError ? data.data : [];
  return <section aria-labelledby="reconciliation-heading" className="space-y-5 text-secondary">
    <div className="space-y-2">
      <h2 id="reconciliation-heading" className="text-xl font-semibold">Payment reconciliation</h2>
      <p>Read-only operation history. Unknown outcomes are not successful payments. The report does not send transfers or retry payments. Original refunds use a separate, audited confirmation workflow when enabled.</p>
      <p className="font-semibold">{filters.provenance === 'TEST' ? 'TEST — sandbox records only' : 'LIVE — production records only'}</p>
      <p className="text-sm">Legacy records and payout settlements are separate. Refund requests are not evidence that a refund was completed.</p>
    </div>
    <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={event => {
      event.preventDefault(); change({ reference: draftReference.trim(), storeId: draftStore.trim() });
    }}>
      <label htmlFor="reconciliation-mode" className="space-y-1.5 text-sm font-medium">Environment
        <Select id="reconciliation-mode" value={filters.provenance} onChange={event => change({ provenance: event.target.value as MoneyMode })} options={[{ value: 'LIVE', label: 'Live' }, { value: 'TEST', label: 'Test / sandbox' }]} />
      </label>
      <label htmlFor="reconciliation-state" className="space-y-1.5 text-sm font-medium">Operation status
        <Select id="reconciliation-state" value={filters.state} onChange={event => change({ state: event.target.value })} options={[{ value: '', label: 'Unresolved outcomes' }, ...states.map(state => ({ value: state, label: state.replaceAll('_', ' ') }))]} />
      </label>
      <label htmlFor="reconciliation-kind" className="space-y-1.5 text-sm font-medium">Operation type
        <Select id="reconciliation-kind" value={filters.kind} onChange={event => change({ kind: event.target.value })} options={[{ value: '', label: 'All operation types' }, { value: 'PAYMENT_CREATE', label: 'Payment creation' }, { value: 'CAPTURE', label: 'Capture' }, { value: 'REFUND', label: 'Refund' }]} />
      </label>
      <Input label="Order number or transaction reference (exact)" id="reconciliation-reference" fullWidth className="min-h-11" maxLength={150} value={draftReference} onChange={event => setDraftReference(event.target.value)} />
      <Input label="Filter by store ID" id="reconciliation-store" fullWidth className="min-h-11" maxLength={150} value={draftStore} onChange={event => setDraftStore(event.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Apply search</Button>
        <Button type="button" variant="secondary" disabled={report.isFetching} onClick={() => void report.refetch()}>Refresh</Button>
      </div>
    </form>
    {(filters.reference || filters.storeId) && <p className="text-sm [overflow-wrap:anywhere]">Applied search: {filters.reference || 'any reference'} · Store: {filters.storeId || 'all stores'}</p>}
    <div role="status" aria-live="polite">
      {report.isFetching ? 'Loading reconciliation records…' : valid && !report.isError ? `${data.total} matching operations. Newest first.` : ''}
    </div>
    {(report.isError || (data && !valid)) && <div role="alert" className="border border-error rounded-card p-4 space-y-3">
      <p>Reconciliation data could not be verified. No amounts or outcomes have been assumed.</p>
      <Button type="button" variant="secondary" disabled={report.isFetching} onClick={() => void report.refetch()}>Retry loading reconciliation</Button>
    </div>}
    {valid && !report.isError && !report.isFetching && !rows.length && <p>No operations match these filters. Try another status or reference.</p>}
    {rows.map(row => <article key={row.id} className="min-w-0 rounded-card border border-border bg-surface p-4 sm:p-5 space-y-4 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="font-semibold">{row.orderNumber} · {row.kind}</h3>
        <Badge>{row.state.replaceAll('_', ' ')}</Badge>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div><dt>Expected amount</dt><dd className="font-semibold tabular-nums">{formatCapturedUsd(row.expectedMinor)}</dd></div>
        <div><dt>Verified amount</dt><dd className="font-semibold tabular-nums">{row.verifiedMinor === null ? 'Not verified' : formatCapturedUsd(row.verifiedMinor)}</dd></div>
        <div><dt>Difference</dt><dd className="font-semibold tabular-nums">{row.differenceMinor === null ? 'Unknown' : formatCapturedUsd(row.differenceMinor)}</dd></div>
      </dl>
      <p className="text-sm">{row.evidenceStatus === 'CAPTURE_VERIFIED' ? 'Verified capture evidence'
        : row.evidenceStatus === 'REFUND_VERIFIED' ? 'Verified refund evidence' : 'No verified completion evidence'} · {row.provider}</p>
      <details className="border-t border-border pt-2">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">Transaction details</summary>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            ['Operation ID', row.id], ['Order ID', row.orderId], ['Provider reference', row.providerReference ?? 'Not recorded'],
            ['Original capture ID', row.captureId ?? 'Not recorded'], ['Created (UTC)', row.createdAt],
            ['Dispatched (UTC)', row.dispatchedAt ?? 'Not recorded'], ['Reconcile after (UTC)', row.reconcileAfter ?? 'Not scheduled'],
            ['Verified (UTC)', row.verifiedAt ?? 'Not verified'],
            ...(row.refundRequest ? [['Refund request ID', row.refundRequest.id], ['Requested by', row.refundRequest.requestedBy], ['Refund reason', row.refundRequest.reason],
              [row.evidenceStatus === 'REFUND_VERIFIED' ? 'Booked platform rounding (USD)' : 'Planned platform rounding (USD)', formatCapturedUsd(row.refundRequest.platformRoundingMinor)]] : []),
          ].map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {row.refundRequest && <p className="mt-3 text-sm">{row.evidenceStatus === 'REFUND_VERIFIED'
          ? 'Rounding was booked with the verified refund; the original capture and paid settlements remain unchanged.'
          : 'Rounding is planned from the original allocations, not a booked expense or proof of refund completion.'}</p>}
        {row.captureId && (row.evidenceStatus === 'CAPTURE_VERIFIED' || row.refundRequest) && <div className="mt-4">
          <EconomicRefundWorkflow key={`${actorId}:${row.captureId}:${filters.provenance}`} actorId={actorId} captureId={row.captureId} mode={filters.provenance} />
        </div>}
      </details>
    </article>)}
    {valid && !report.isError && <Pagination page={page} totalPages={Math.max(1, Math.ceil(data.total / 20))} onPageChange={setPage} disabled={report.isFetching} labels={{ navAria: 'Reconciliation pages', previousAria: 'Previous operations', nextAria: 'Next operations' }} />}
  </section>;
}
