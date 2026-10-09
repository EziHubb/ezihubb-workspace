'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { MoneyMode } from '../../lib/economic-finances';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, Pagination, Select, Textarea } from '@ezihubb/ui';

interface RecoveryRow {
  id: string; orderId: string; orderNumber: string; eventType: string; state: 'DEAD'; attempts: number;
  recovery: { actorId: string; reason: string; applied: boolean; createdAt: string } | null;
}
interface RecoveryHistory {
  version: 'economic-v1'; provenance: MoneyMode; currency: 'USD'; recoveryEnabled: boolean;
  page: number; limit: number; total: number; data: RecoveryRow[];
}

export function EconomicRecoveryPanel({ actorId }: { actorId: string }) {
  const [mode, setMode] = useState<MoneyMode>('LIVE'), [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RecoveryRow | null>(null), [reason, setReason] = useState(''), [done, setDone] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cache = useQueryClient();
  const report = useQuery({ queryKey: ['economic-recovery', actorId, 'platform', mode, page], retry: false,
    queryFn: () => api.get<RecoveryHistory>('/admin/economic-finances/lifecycle-recovery', { params: { provenance: mode, currency: 'USD', page, limit: 20 } }) });
  const data = report.data;
  const valid = data?.version === 'economic-v1' && data.provenance === mode && data.currency === 'USD'
    && data.page === page && data.limit === 20 && Number.isSafeInteger(data.total) && data.total >= 0
    && typeof data.recoveryEnabled === 'boolean' && Array.isArray(data.data)
    && data.data.every(row => typeof row.id === 'string' && typeof row.orderNumber === 'string'
      && row.state === 'DEAD' && Number.isSafeInteger(row.attempts) && row.attempts >= 0
      && ['capture.verified.v1','refund.verified.v1'].includes(row.eventType));
  const mutation = useMutation({ mutationFn: async () => {
    if (!selected || !valid || !data.recoveryEnabled || !reason.trim()) throw new Error('Select an event and provide an audit reason');
    const result = await api.post<{ applied: boolean; alreadyRecovered: boolean }>(`/admin/economic-finances/outbox/${encodeURIComponent(selected.id)}/recover-lifecycle`,
      { reason: reason.trim() }, { params: { provenance: mode, currency: 'USD' } });
    if (typeof result.applied !== 'boolean' || typeof result.alreadyRecovered !== 'boolean') throw new Error('Recovery response could not be verified');
    return result;
  }, onSuccess: async () => {
    setDone(true);
    await cache.invalidateQueries({ queryKey: ['economic-recovery', actorId] });
    await cache.invalidateQueries({ queryKey: ['economic-summary', actorId] });
  } });
  useEffect(() => {
    if (!selected && trigger.current && !trigger.current.isConnected) heading.current?.focus();
  }, [selected]);
  const close = () => { if (!mutation.isPending) setSelected(null); };
  const rows = valid && !report.isFetching && !report.isError ? data.data : [];
  return <section aria-labelledby="lifecycle-recovery-heading" className="space-y-4 text-secondary">
    <h2 ref={heading} tabIndex={-1} id="lifecycle-recovery-heading" className="text-xl font-semibold">Lifecycle recovery</h2>
    <p>Terminal failed events only. Recovery rechecks original proof and inventory, applies missing database effects once, and records your reason. It does not retry a payment, refund, email or POD order.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor="recovery-mode" className="flex flex-col gap-1.5 text-sm font-medium">Recovery environment
        <Select id="recovery-mode" value={mode} disabled={!!selected} onChange={event => { setMode(event.target.value as MoneyMode); setPage(1); }} options={[{ value: 'LIVE', label: 'Live' }, { value: 'TEST', label: 'Test / sandbox' }]} />
      </label>
      <Button type="button" variant="secondary" disabled={report.isFetching || !!selected} onClick={() => void report.refetch()}>Refresh recovery records</Button>
    </div>
    <p className="font-semibold">{mode === 'LIVE' ? 'LIVE — production records only' : 'TEST — sandbox records only'}</p>
    <div role="status" aria-live="polite">{report.isFetching ? 'Loading recovery records…' : valid && !report.isError ? `${data.total} terminal events` : ''}</div>
    {(report.isError || (data && !valid)) && <div role="alert" className="rounded-card border border-error p-4">
      <p>Recovery records could not be verified. No action is available.</p>
      <Button type="button" variant="secondary" disabled={report.isFetching || !!selected} onClick={() => void report.refetch()}>Retry recovery records</Button>
    </div>}
    {valid && !report.isFetching && !report.isError && !rows.length && <p>No terminal events in this environment.</p>}
    {rows.map(row => <article key={row.id} className="rounded-card border border-border p-4 space-y-3 [overflow-wrap:anywhere]">
      <h3 className="font-semibold">{row.orderNumber} · {row.eventType}</h3>
      <p>Event {row.id} · DEAD · {row.attempts} original attempts</p>
      {row.recovery ? <p>Database recovery recorded by {row.recovery.actorId}: {row.recovery.reason}. {row.recovery.applied ? 'Missing effects applied.' : 'Original effects were already applied.'}</p>
        : <Button type="button" variant="secondary" disabled={!data?.recoveryEnabled} onClick={event => {
          trigger.current = event.currentTarget; setReason(''); setDone(false); mutation.reset(); setSelected(row);
        }}>Review lifecycle recovery</Button>}
    </article>)}
    {valid && !data.recoveryEnabled && <p>Recovery writes are disabled for this environment.</p>}
    {valid && !report.isError && <Pagination page={page} totalPages={Math.max(1, Math.ceil(data.total / data.limit))} onPageChange={setPage} disabled={report.isFetching || !!selected} labels={{ navAria: 'Recovery pages', previousAria: 'Previous recovery events', nextAria: 'Next recovery events' }} />}
    {selected && <Modal isOpen native size="lg" dismissible={!mutation.isPending} closeOnOverlayClick={false} onClose={close} aria-labelledby="recover-confirm-heading" aria-describedby="recover-confirm-description">
      <form className="flex min-h-0 flex-col" onSubmit={event => { event.preventDefault(); if (!mutation.isPending && !done) mutation.mutate(); }}>
        <ModalHeader><h3 id="recover-confirm-heading">Confirm database lifecycle recovery</h3></ModalHeader>
        <ModalBody className="space-y-4 text-sm text-secondary">
        <p id="recover-confirm-description" className="[overflow-wrap:anywhere]">{mode} · {selected.orderNumber} · {selected.id}. The original DEAD event stays unchanged. No provider operation will be resent.</p>
        <Textarea label="Audit reason (required)" id="recovery-reason" fullWidth required maxLength={500} value={reason} disabled={mutation.isPending || done} onChange={event => setReason(event.target.value)} />
        {mutation.isError && <p role="alert">{mutation.error.message}. The outcome may be unknown; retry only this same event after reviewing the records.</p>}
        <p role="status" aria-live="polite">{done ? 'Recovery recorded. Original financial evidence and attempt history were preserved.' : mutation.isPending ? 'Verifying original evidence and applying database recovery…' : ''}</p>
        </ModalBody>
        <ModalFooter className="flex-wrap">
          <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={close}>{done ? 'Close recovery confirmation' : 'Cancel recovery'}</Button>
          <Button type="submit" loading={mutation.isPending} disabled={done || !reason.trim()}>Confirm lifecycle recovery</Button>
        </ModalFooter>
      </form>
    </Modal>}
  </section>;
}
