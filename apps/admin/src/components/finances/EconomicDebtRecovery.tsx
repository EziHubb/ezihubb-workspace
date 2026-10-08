'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { BeneficiaryKind, formatCapturedUsd, MoneyMode } from '../../lib/economic-finances';

const control = 'min-h-11 rounded-button border border-border px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
export function EconomicDebtRecovery({ kind, beneficiaryId, mode, debtMinor }: {
  kind: BeneficiaryKind; beneficiaryId: string; mode: MoneyMode; debtMinor: string;
}) {
  const qc = useQueryClient(), dialog = useRef<HTMLDialogElement>(null), submitting = useRef(false);
  const [open, setOpen] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const currentDialog = dialog.current;
    currentDialog?.showModal();
    return () => { currentDialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [open]);
  const mutation = useMutation({ mutationFn: () => api.post<{ recoveredMinor: string }>('/admin/economic-finances/debt/recover', {},
    { params: { kind, beneficiaryId, provenance: mode, currency: 'USD' } }),
  onSuccess: result => {
    if (!/^\d+$/.test(result.recoveredMinor)) throw new Error('Invalid recovery result');
    setMessage(`${formatCapturedUsd(result.recoveredMinor)} retained against debt. No external debit or transfer was sent.`);
    setError(''); setOpen(false);
  }, onError: () => setError('Recovery could not be confirmed. Refresh the same account; never issue an external debit.'),
  onSettled: () => { submitting.current = false; return qc.invalidateQueries({ queryKey: ['captured-finances'] }); } });
  function close() { if (!mutation.isPending) setOpen(false); }
  return <section className="rounded-card border border-border p-5 space-y-3">
    <h2 className="font-semibold">Recover outstanding debt</h2>
    <p className="text-sm">Retain only eligible, unreserved captured funds in this exact account and environment. A retry cannot collect the same debt twice.</p>
    <button type="button" className={control} onClick={() => setOpen(true)} disabled={!/^\d+$/.test(debtMinor) || debtMinor === '0'}>Review debt recovery</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-error">{error}</p>}
    {open && <dialog ref={dialog} aria-labelledby="debt-recovery-title" onCancel={event => { if (mutation.isPending) event.preventDefault(); else close(); }} onClose={close}
      style={{ margin: 'auto', width: 'calc(100% - 2rem)', maxHeight: 'calc(100dvh - 2rem)' }} className="max-w-lg overflow-y-auto rounded-card border border-border bg-surface p-5 text-secondary backdrop:bg-black/50">
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!submitting.current) { submitting.current = true; mutation.mutate(); } }}>
        <h2 id="debt-recovery-title" className="text-xl font-semibold">Confirm account debt recovery</h2>
        <p className="break-all">{mode} · {kind} · {beneficiaryId}</p>
        <p>Outstanding debt: {formatCapturedUsd(debtMinor)}. Recovery is capped by current debt and eligible funds at confirmation. Paid payout history remains unchanged.</p>
        {error && <p role="alert" className="text-error">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={control} onClick={close} disabled={mutation.isPending}>Cancel debt recovery</button>
          <button type="submit" className={control} disabled={mutation.isPending}>{mutation.isPending ? 'Recovering…' : 'Confirm debt recovery'}</button>
        </div>
      </form>
    </dialog>}
  </section>;
}
