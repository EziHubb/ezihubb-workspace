'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { BeneficiaryKind, formatCapturedUsd, MoneyMode } from '../../lib/economic-finances';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@ezihubb/ui';

export function EconomicDebtRecovery({ kind, beneficiaryId, mode, debtMinor }: {
  kind: BeneficiaryKind; beneficiaryId: string; mode: MoneyMode; debtMinor: string;
}) {
  const qc = useQueryClient(), submitting = useRef(false);
  const [open, setOpen] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: () => api.post<{ recoveredMinor: string }>('/admin/economic-finances/debt/recover', {},
    { params: { kind, beneficiaryId, provenance: mode, currency: 'USD' } }),
  onSuccess: result => {
    if (!/^\d+$/.test(result.recoveredMinor)) throw new Error('Invalid recovery result');
    setMessage(`${formatCapturedUsd(result.recoveredMinor)} retained against debt. No external debit or transfer was sent.`);
    setError(''); setOpen(false);
  }, onError: () => setError('Recovery could not be confirmed. Refresh the same account; never issue an external debit.'),
  onSettled: () => { submitting.current = false; return Promise.all([
    qc.invalidateQueries({ queryKey: ['captured-finances'] }),
    qc.invalidateQueries({ queryKey: ['economic-summary'] }),
  ]); } });
  function close() { if (!mutation.isPending) setOpen(false); }
  return <section className="rounded-card border border-border p-5 space-y-3">
    <h2 className="font-semibold">Recover outstanding debt</h2>
    <p className="text-sm">Retain only eligible, unreserved captured funds in this exact account and environment. A retry cannot collect the same debt twice.</p>
    <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={!/^\d+$/.test(debtMinor) || debtMinor === '0'}>Review debt recovery</Button>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-error">{error}</p>}
    {open && <Modal isOpen native dismissible={!mutation.isPending} closeOnOverlayClick={false} aria-labelledby="debt-recovery-title" onClose={close}>
      <form className="flex min-h-0 flex-col" onSubmit={event => { event.preventDefault(); if (!submitting.current) { submitting.current = true; mutation.mutate(); } }}>
        <ModalHeader><h2 id="debt-recovery-title">Confirm account debt recovery</h2></ModalHeader>
        <ModalBody className="space-y-4 text-sm text-secondary">
        <p className="break-all">{mode} · {kind} · {beneficiaryId}</p>
        <p>Outstanding debt: {formatCapturedUsd(debtMinor)}. Recovery is capped by current debt and eligible funds at confirmation. Paid payout history remains unchanged.</p>
        {error && <p role="alert" className="text-error">{error}</p>}
        </ModalBody>
        <ModalFooter className="flex-wrap">
          <Button type="button" variant="secondary" onClick={close} disabled={mutation.isPending}>Cancel debt recovery</Button>
          <Button type="submit" loading={mutation.isPending}>{mutation.isPending ? 'Recovering…' : 'Confirm debt recovery'}</Button>
        </ModalFooter>
      </form>
    </Modal>}
  </section>;
}
