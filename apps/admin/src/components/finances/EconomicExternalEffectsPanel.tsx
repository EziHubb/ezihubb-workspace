'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { MoneyMode } from '../../lib/economic-finances';
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Pagination, Select, Textarea } from '@ezihubb/ui';

interface EffectRow { id: string; orderId: string; storeOrderId: string | null; kind: 'POD_PRINTIFY' | 'EMAIL_TRANSACTIONAL';
  state: 'PREPARED' | 'DISPATCHED' | 'NEEDS_RECONCILIATION' | 'SUCCEEDED'; providerReference: string | null;
  requestedBy: string; reason: string; resultBasis: 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY' | 'ORIGINAL_PROVIDER_RESOURCE'; }
interface Report { version: 'economic-v1'; provenance: MoneyMode; currency: 'USD'; total: number; page: number; limit: number;
  podEnabled: boolean; data: EffectRow[]; }

export function EconomicExternalEffectsPanel({ actorId }: { actorId: string }) {
  const [mode, setMode] = useState<MoneyMode>('LIVE'), [page, setPage] = useState(1), [kind, setKind] = useState('');
  const [state, setState] = useState(''), [orderSearch, setOrderSearch] = useState(''), [orderId, setOrderId] = useState('');
  const [storeOrderId, setStoreOrderId] = useState(''), [reason, setReason] = useState('');
  const [selected, setSelected] = useState<EffectRow | null>(null), [reference, setReference] = useState(''), [done, setDone] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null), heading = useRef<HTMLHeadingElement>(null);
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
  const invalidate = async () => { await Promise.all([
    cache.invalidateQueries({ queryKey: ['economic-external', actorId] }),
    cache.invalidateQueries({ queryKey: ['economic-summary', actorId] }),
  ]); };
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
  useEffect(() => { if (!selected && trigger.current && !trigger.current.isConnected) heading.current?.focus(); }, [selected]);
  const close = () => { if (!execute.isPending) setSelected(null); };
  const busy = prepare.isPending || execute.isPending;
  const rows = valid && !report.isFetching && !report.isError ? data.data : [];
  return <section className="space-y-4 text-secondary" aria-labelledby="external-effects-heading">
    <h2 id="external-effects-heading" ref={heading} tabIndex={-1} className="text-xl font-semibold">POD and notification reconciliation</h2>
    <p>Original versioned intents only. A provider timeout is not a failed order: recovery reads the original resource and never creates it again. Personalized artwork and unsupported providers remain manual.</p>
    <div className="flex flex-wrap gap-3 items-end">
      <label className="flex flex-col gap-1.5 text-sm font-medium min-w-0" htmlFor="external-mode">External-effect environment
        <Select id="external-mode" value={mode} disabled={busy || !!selected} onChange={event => {
          setMode(event.target.value as MoneyMode); setPage(1); prepare.reset(); execute.reset();
        }} options={[{ value: 'LIVE', label: 'Live' }, { value: 'TEST', label: 'Test / sandbox (no buyer or POD sends)' }]} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="external-state">External outcome
        <Select id="external-state" value={state} disabled={busy || !!selected} onChange={event => { setState(event.target.value); setPage(1); }} options={[{ value: '', label: 'All outcomes' }, { value: 'PREPARED', label: 'Prepared' }, { value: 'DISPATCHED', label: 'Dispatched / awaiting evidence' }, { value: 'NEEDS_RECONCILIATION', label: 'Needs reconciliation' }, { value: 'SUCCEEDED', label: 'Verified' }]} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="external-kind">Effect type
        <Select id="external-kind" value={kind} disabled={busy || !!selected} onChange={event => { setKind(event.target.value); setPage(1); }} options={[{ value: '', label: 'All effects' }, { value: 'POD_PRINTIFY', label: 'Printify POD' }, { value: 'EMAIL_TRANSACTIONAL', label: 'Transactional email' }]} />
      </label>
      <Button type="button" variant="secondary" disabled={busy || report.isFetching || !!selected} onClick={() => void report.refetch()}>Refresh external effects</Button>
    </div>
    <form className="flex flex-wrap gap-3 items-center" onSubmit={event => { event.preventDefault(); setOrderId(orderSearch.trim()); setPage(1); }}>
      <Input label="Find external effects by original order ID" id="external-order-search" className="min-h-11" value={orderSearch} maxLength={150} disabled={busy || !!selected} onChange={event => setOrderSearch(event.target.value)} />
      <Button type="submit" disabled={busy || report.isFetching || !!selected}>Search external effects</Button>
    </form>
    <p className="font-semibold">{mode} — {mode === 'TEST' ? 'No external dispatch to live connections or buyers.' : 'Production records only; separate activation gates apply.'}</p>
    <div role="status" aria-live="polite">{report.isFetching ? 'Loading external effects…' : valid && !report.isError ? `${data.total} original intents` : ''}</div>
    {(report.isError || (data && !valid)) && <p role="alert">External records could not be verified. Actions are unavailable.</p>}
    {valid && !data.podEnabled && <p>POD dispatch is disabled for this environment. No provider request can be sent here.</p>}
    <form className="rounded-card border border-border p-4 space-y-3" onSubmit={event => { event.preventDefault(); if (!busy) prepare.mutate(); }}>
      <h3 className="font-semibold">Prepare a frozen POD intent (database only)</h3>
      <Input label="Original shop order ID" id="pod-shop-order" fullWidth className="min-h-11" required maxLength={150} value={storeOrderId} disabled={!actionable || busy || !!selected} onChange={event => { setStoreOrderId(event.target.value); prepare.reset(); }} />
      <Textarea label="POD audit reason" id="pod-audit-reason" fullWidth required maxLength={500} value={reason} disabled={!actionable || busy || !!selected} onChange={event => { setReason(event.target.value); prepare.reset(); }} />
      <Button type="submit" loading={prepare.isPending} disabled={!actionable || busy || !!selected || !storeOrderId.trim() || !reason.trim()}>Prepare POD intent</Button>
      {prepare.isError && <p role="alert">{prepare.error.message}. Reload original records; do not create a replacement to bypass reconciliation.</p>}
      <p role="status" aria-live="polite">{prepare.isPending ? 'Verifying original shop and mappings…' : prepare.isSuccess ? `Frozen intents: ${prepare.data.ids.join(', ')}. No provider order was sent.` : ''}</p>
    </form>
    {rows.map(row => <article className="rounded-card border border-border p-4 space-y-2 [overflow-wrap:anywhere]" key={row.id}>
      <h3 className="font-semibold">{row.kind === 'POD_PRINTIFY' ? 'Printify POD' : 'Transactional email'} · {row.state}</h3>
      <p>Order {row.orderId}{row.storeOrderId ? ` · Shop order ${row.storeOrderId}` : ''} · Intent {row.id}</p>
      <p>Requested by {row.requestedBy}: {row.reason}</p><p>Original reference: {row.providerReference ?? 'Not verified'}</p>
      {row.kind === 'EMAIL_TRANSACTIONAL' ? <p>{row.state === 'SUCCEEDED' ? 'SMTP accepted this message; inbox delivery is not verified.' : 'No verified SMTP acceptance. An ambiguous send will not be automatically resent.'}</p>
        : row.state === 'SUCCEEDED' ? <p>Original provider creation verified. Production, delivery and actual cost are separate evidence.</p>
        : ['PREPARED','DISPATCHED','NEEDS_RECONCILIATION'].includes(row.state) && <Button type="button" variant="secondary"
          disabled={!actionable || busy} onClick={event => { trigger.current = event.currentTarget; setSelected(row); setReference(''); setDone(false); execute.reset(); }}>
          {row.state === 'PREPARED' ? 'Review POD dispatch' : 'Look up original POD outcome'}</Button>}
    </article>)}
    {valid && !report.isFetching && !report.isError && !rows.length && <p>No external effects in this environment.</p>}
    {valid && !report.isError && <Pagination page={page} totalPages={Math.max(1, Math.ceil(data.total / data.limit))} onPageChange={setPage} disabled={busy || report.isFetching || !!selected} labels={{ navAria: 'External effect pages', previousAria: 'Previous external effects', nextAria: 'Next external effects' }} />}
    {selected && <Modal isOpen native size="lg" dismissible={!execute.isPending} closeOnOverlayClick={false} onClose={close} aria-labelledby="pod-confirm-heading" aria-describedby="pod-confirm-description">
      <form className="flex min-h-0 flex-col" onSubmit={event => { event.preventDefault(); if (!execute.isPending && !done) execute.mutate(); }}>
      <ModalHeader><h3 id="pod-confirm-heading">{selected.state === 'PREPARED' ? 'Confirm one-time POD dispatch' : 'Verify original POD outcome'}</h3></ModalHeader>
      <ModalBody className="space-y-4 text-sm text-secondary">
      <p id="pod-confirm-description" className="[overflow-wrap:anywhere]">{mode} · {selected.id}. {selected.state === 'PREPARED'
        ? 'This sends one provider create request using the frozen items and address. A timeout must be reconciled, not resent.'
        : 'This only reads the original provider order. A supplied reference is a lookup hint, not evidence. No new order will be created.'}</p>
        {selected.state !== 'PREPARED' && <Input label="Original provider order reference" id="pod-original-reference" fullWidth className="min-h-11" maxLength={150} pattern="[A-Za-z0-9_-]+" required={!selected.providerReference}
            value={reference} disabled={execute.isPending || done} onChange={event => setReference(event.target.value)} />}
        {execute.isError && <p role="alert">{execute.error.message}. Outcome may be unknown. Review the original intent and provider order; never send a replacement.</p>}
        <p role="status" aria-live="polite">{done ? 'Original provider creation verified. No duplicate was sent.' : execute.isPending ? 'Checking the original provider outcome…' : ''}</p>
        </ModalBody>
        <ModalFooter className="flex-wrap">
          <Button type="button" variant="secondary" disabled={execute.isPending} onClick={close}>{done ? 'Close POD confirmation' : 'Cancel POD action'}</Button>
          <Button type="submit" loading={execute.isPending} disabled={execute.isPending || done || !valid || !data.podEnabled
            || (execute.isError && selected.state === 'PREPARED')}>Confirm original POD action</Button>
        </ModalFooter>
      </form>
    </Modal>}
  </section>;
}
