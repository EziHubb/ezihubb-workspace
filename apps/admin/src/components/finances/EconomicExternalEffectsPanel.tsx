'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { MoneyMode } from '../../lib/economic-finances';

interface EffectRow { id: string; orderId: string; storeOrderId: string | null; kind: 'POD_PRINTIFY' | 'EMAIL_TRANSACTIONAL';
  state: 'PREPARED' | 'DISPATCHED' | 'NEEDS_RECONCILIATION' | 'SUCCEEDED'; providerReference: string | null;
  requestedBy: string; reason: string; resultBasis: 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY' | 'ORIGINAL_PROVIDER_RESOURCE'; }
interface Report { version: 'economic-v1'; provenance: MoneyMode; currency: 'USD'; total: number; page: number; limit: number;
  podEnabled: boolean; data: EffectRow[]; }
const control = 'min-h-11 rounded-button border border-border bg-surface px-3 py-2 text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';

export function EconomicExternalEffectsPanel({ actorId }: { actorId: string }) {
  const [mode, setMode] = useState<MoneyMode>('LIVE'), [page, setPage] = useState(1), [kind, setKind] = useState('');
  const [state, setState] = useState(''), [orderSearch, setOrderSearch] = useState(''), [orderId, setOrderId] = useState('');
  const [storeOrderId, setStoreOrderId] = useState(''), [reason, setReason] = useState('');
  const [selected, setSelected] = useState<EffectRow | null>(null), [reference, setReference] = useState(''), [done, setDone] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const cache = useQueryClient();
  const report = useQuery({ queryKey: ['economic-external', actorId, mode, kind, state, orderId, page], retry: false,
    queryFn: () => api.get<Report>('/admin/economic-finances/external-effects', { params: { provenance: mode, currency: 'USD',
      page, limit: 20, ...(kind ? { kind } : {}), ...(state ? { state } : {}), ...(orderId ? { orderId } : {}) } }) });
  const data = report.data;
  const valid = data?.version === 'economic-v1' && data.provenance === mode && data.currency === 'USD'
    && data.page === page && data.limit === 20 && Number.isSafeInteger(data.total) && data.total >= 0
    && typeof data.podEnabled === 'boolean' && Array.isArray(data.data) && data.data.every(row => row && typeof row.id === 'string'
      && typeof row.orderId === 'string' && typeof row.requestedBy === 'string' && typeof row.reason === 'string'
      && (row.providerReference === null || typeof row.providerReference === 'string')
      && ['PREPARED','DISPATCHED','NEEDS_RECONCILIATION','SUCCEEDED'].includes(row.state)
      && ((row.kind === 'POD_PRINTIFY' && row.resultBasis === 'ORIGINAL_PROVIDER_RESOURCE')
        || (row.kind === 'EMAIL_TRANSACTIONAL' && row.resultBasis === 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY')));
  const actionable = valid && !report.isFetching && !report.isError && data.podEnabled;
  const invalidate = async () => { await cache.invalidateQueries({ queryKey: ['economic-external', actorId] }); };
  const prepare = useMutation({ mutationFn: async () => {
    if (!actionable || !storeOrderId.trim() || !reason.trim()) throw new Error('Verified enabled scope and audit reason required');
    const result = await api.post<{ ids: string[]; alreadyPrepared: boolean }>(`/admin/economic-finances/store-orders/${encodeURIComponent(storeOrderId.trim())}/pod-intents`,
      { reason: reason.trim() }, { params: { provenance: mode, currency: 'USD' } });
    if (!Array.isArray(result.ids) || !result.ids.length || !result.ids.every(id => typeof id === 'string') || typeof result.alreadyPrepared !== 'boolean') throw new Error('Preparation result could not be verified');
    return result;
  }, onSuccess: invalidate });
  const execute = useMutation({ mutationFn: async () => {
    if (!selected || !valid || !data.podEnabled) throw new Error('Verified POD intent required');
    const result = await api.post<{ id: string; state: string; providerReference: string }>(`/admin/economic-finances/external-effects/${encodeURIComponent(selected.id)}/execute-pod`,
      reference.trim() ? { reference: reference.trim() } : {}, { params: { provenance: mode, currency: 'USD' } });
    if (result.id !== selected.id || result.state !== 'SUCCEEDED' || typeof result.providerReference !== 'string') throw new Error('Provider result could not be verified');
    return result;
  }, onSuccess: async () => { setDone(true); await invalidate(); } });
  useEffect(() => { if (selected && !dialog.current?.open) dialog.current?.showModal(); }, [selected]);
  const busy = prepare.isPending || execute.isPending;
  const rows = valid && !report.isFetching && !report.isError ? data.data : [];
  return <section className="space-y-4 text-secondary" aria-labelledby="external-effects-heading">
    <h2 id="external-effects-heading" ref={heading} tabIndex={-1} className="text-xl font-semibold">POD and notification reconciliation</h2>
    <p>Original versioned intents only. A provider timeout is not a failed order: recovery reads the original resource and never creates it again. Personalized artwork and unsupported providers remain manual.</p>
    <div className="flex flex-wrap gap-3 items-end">
      <label className="flex flex-col gap-2" htmlFor="external-mode">External-effect environment
        <select id="external-mode" className={control} value={mode} disabled={busy || !!selected} onChange={event => {
          setMode(event.target.value as MoneyMode); setPage(1); prepare.reset(); execute.reset();
        }}><option value="LIVE">Live</option><option value="TEST">Test / sandbox (no buyer or POD sends)</option></select>
      </label>
      <label className="flex flex-col gap-2" htmlFor="external-state">External outcome
        <select id="external-state" className={control} value={state} disabled={busy || !!selected} onChange={event => { setState(event.target.value); setPage(1); }}>
          <option value="">All outcomes</option><option value="PREPARED">Prepared</option><option value="DISPATCHED">Dispatched / awaiting evidence</option>
          <option value="NEEDS_RECONCILIATION">Needs reconciliation</option><option value="SUCCEEDED">Verified</option>
        </select>
      </label>
      <label className="flex flex-col gap-2" htmlFor="external-kind">Effect type
        <select id="external-kind" className={control} value={kind} disabled={busy || !!selected} onChange={event => { setKind(event.target.value); setPage(1); }}>
          <option value="">All effects</option><option value="POD_PRINTIFY">Printify POD</option><option value="EMAIL_TRANSACTIONAL">Transactional email</option>
        </select>
      </label>
      <button type="button" className={control} disabled={busy || report.isFetching || !!selected} onClick={() => void report.refetch()}>Refresh external effects</button>
    </div>
    <form className="flex flex-wrap gap-3 items-end" onSubmit={event => { event.preventDefault(); setOrderId(orderSearch.trim()); setPage(1); }}>
      <label className="flex flex-col gap-2" htmlFor="external-order-search">Find external effects by original order ID
        <input id="external-order-search" className={control} value={orderSearch} maxLength={150} disabled={busy || !!selected} onChange={event => setOrderSearch(event.target.value)} />
      </label>
      <button type="submit" className={control} disabled={busy || report.isFetching || !!selected}>Search external effects</button>
    </form>
    <p className="font-semibold">{mode} — {mode === 'TEST' ? 'No external dispatch to live connections or buyers.' : 'Production records only; separate activation gates apply.'}</p>
    <div role="status" aria-live="polite">{report.isFetching ? 'Loading external effects…' : valid && !report.isError ? `${data.total} original intents` : ''}</div>
    {(report.isError || (data && !valid)) && <p role="alert">External records could not be verified. Actions are unavailable.</p>}
    {valid && !data.podEnabled && <p>POD dispatch is disabled for this environment. No provider request can be sent here.</p>}
    <form className="rounded-card border border-border p-4 space-y-3" onSubmit={event => { event.preventDefault(); if (!busy) prepare.mutate(); }}>
      <h3 className="font-semibold">Prepare a frozen POD intent (database only)</h3>
      <label className="flex flex-col gap-2" htmlFor="pod-shop-order">Original shop order ID
        <input id="pod-shop-order" className={control} required maxLength={150} value={storeOrderId} disabled={!actionable || busy || !!selected} onChange={event => { setStoreOrderId(event.target.value); prepare.reset(); }} />
      </label>
      <label className="flex flex-col gap-2" htmlFor="pod-audit-reason">POD audit reason
        <textarea id="pod-audit-reason" className={control} required maxLength={500} value={reason} disabled={!actionable || busy || !!selected} onChange={event => { setReason(event.target.value); prepare.reset(); }} />
      </label>
      <button type="submit" className={control} disabled={!actionable || busy || !!selected || !storeOrderId.trim() || !reason.trim()}>Prepare POD intent</button>
      {prepare.isError && <p role="alert">{prepare.error.message}. Reload original records; do not create a replacement to bypass reconciliation.</p>}
      <p role="status" aria-live="polite">{prepare.isPending ? 'Verifying original shop and mappings…' : prepare.isSuccess ? `Frozen intents: ${prepare.data.ids.join(', ')}. No provider order was sent.` : ''}</p>
    </form>
    {rows.map(row => <article className="rounded-card border border-border p-4 space-y-2 [overflow-wrap:anywhere]" key={row.id}>
      <h3 className="font-semibold">{row.kind === 'POD_PRINTIFY' ? 'Printify POD' : 'Transactional email'} · {row.state}</h3>
      <p>Order {row.orderId}{row.storeOrderId ? ` · Shop order ${row.storeOrderId}` : ''} · Intent {row.id}</p>
      <p>Requested by {row.requestedBy}: {row.reason}</p><p>Original reference: {row.providerReference ?? 'Not verified'}</p>
      {row.kind === 'EMAIL_TRANSACTIONAL' ? <p>{row.state === 'SUCCEEDED' ? 'SMTP accepted this message; inbox delivery is not verified.' : 'No verified SMTP acceptance. An ambiguous send will not be automatically resent.'}</p>
        : row.state === 'SUCCEEDED' ? <p>Original provider creation verified. Production, delivery and actual cost are separate evidence.</p>
        : ['PREPARED','DISPATCHED','NEEDS_RECONCILIATION'].includes(row.state) && <button type="button" className={control}
          disabled={!actionable || busy} onClick={event => { trigger.current = event.currentTarget; setSelected(row); setReference(''); setDone(false); execute.reset(); }}>
          {row.state === 'PREPARED' ? 'Review POD dispatch' : 'Look up original POD outcome'}</button>}
    </article>)}
    {valid && !report.isFetching && !report.isError && !rows.length && <p>No external effects in this environment.</p>}
    <div className="flex flex-wrap gap-3 items-center">
      <button type="button" className={control} disabled={page === 1 || busy || report.isFetching || !!selected} onClick={() => setPage(value => value - 1)}>Previous external effects</button>
      <span>Page {page}{valid ? ` of ${Math.max(1, Math.ceil(data.total / data.limit))}` : ''}</span>
      <button type="button" className={control} disabled={!valid || page * data.limit >= data.total || busy || report.isFetching || !!selected} onClick={() => setPage(value => value + 1)}>Next external effects</button>
    </div>
    <dialog ref={dialog} aria-labelledby="pod-confirm-heading" aria-describedby="pod-confirm-description"
      className="m-auto w-[calc(100%_-_2rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-card border border-border bg-surface p-6 text-secondary backdrop:bg-black/50"
      onCancel={event => { if (execute.isPending) event.preventDefault(); }} onClose={() => { setSelected(null); if (trigger.current?.isConnected) trigger.current.focus(); else heading.current?.focus(); }}>
      <h3 id="pod-confirm-heading" className="text-xl font-semibold">{selected?.state === 'PREPARED' ? 'Confirm one-time POD dispatch' : 'Verify original POD outcome'}</h3>
      <p id="pod-confirm-description" className="mt-3">{mode} · {selected?.id}. {selected?.state === 'PREPARED'
        ? 'This sends one provider create request using the frozen items and address. A timeout must be reconciled, not resent.'
        : 'This only reads the original provider order. A supplied reference is a lookup hint, not evidence. No new order will be created.'}</p>
      <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); if (!execute.isPending && !done) execute.mutate(); }}>
        {selected?.state !== 'PREPARED' && <label className="flex flex-col gap-2" htmlFor="pod-original-reference">Original provider order reference
          <input id="pod-original-reference" className={control} maxLength={150} pattern="[A-Za-z0-9_-]+" required={!selected?.providerReference}
            value={reference} disabled={execute.isPending || done} onChange={event => setReference(event.target.value)} />
        </label>}
        {execute.isError && <p role="alert">{execute.error.message}. Outcome may be unknown. Review the original intent and provider order; never send a replacement.</p>}
        <p role="status" aria-live="polite">{done ? 'Original provider creation verified. No duplicate was sent.' : execute.isPending ? 'Checking the original provider outcome…' : ''}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={control} disabled={execute.isPending} onClick={() => dialog.current?.close()}>{done ? 'Close POD confirmation' : 'Cancel POD action'}</button>
          <button type="submit" className={control} disabled={execute.isPending || done || !valid || !data.podEnabled
            || (execute.isError && selected?.state === 'PREPARED')}>Confirm original POD action</button>
        </div>
      </form>
    </dialog>
  </section>;
}
