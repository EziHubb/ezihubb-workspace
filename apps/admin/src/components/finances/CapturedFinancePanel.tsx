'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { BeneficiaryKind, CapturedBalance, CapturedLot, CapturedPayout, EconomicHistory, MoneyMode,
  formatCapturedUsd as money, minorToUsdInput, usdInputToMinor } from '../../lib/economic-finances';
import { EconomicDebtRecovery } from './EconomicDebtRecovery';

const control = 'min-h-11 rounded-button border border-border px-3 py-2 bg-surface text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
type Props = { actorId: string; storeId: string; platform?: { kind: BeneficiaryKind; beneficiaryId: string }; mode: MoneyMode };
type Confirmation = { type: 'request'; amountMinor: string } | { type: 'verify' | 'reject'; payout: CapturedPayout };
type PendingRequest = { idempotencyKey: string; amountMinor: string };

function PageControls({ page, total, change }: { page: number; total: number; change: (page: number) => void }) {
  return <div className="flex items-center justify-between gap-3 mt-4 text-sm">
    <button className={control} disabled={page <= 1} onClick={() => change(page - 1)}>Previous</button>
    <span>Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
    <button className={control} disabled={page * 20 >= total} onClick={() => change(page + 1)}>Next</button>
  </div>;
}
function LoadError({ retry }: { retry: () => void }) {
  return <div role="alert" className="p-4 border border-error rounded-card space-y-3">
    <p>Financial data could not be loaded. No balance or settlement has been assumed.</p>
    <button className={control} onClick={retry}>Retry loading</button>
  </div>;
}

/** Mount with a scope key: drafts, pagination and confirmations cannot cross accounts/modes. */
export function CapturedFinancePanel({ actorId, storeId, platform, mode }: Props) {
  const qc = useQueryClient();
  const [payoutPage, setPayoutPage] = useState(1), [lotPage, setLotPage] = useState(1);
  const [amount, setAmount] = useState(''), [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [proof, setProof] = useState(''), [error, setError] = useState('');
  const [lookupReferences, setLookupReferences] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingRequest | null>(null), [storageReady, setStorageReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const prefix = platform ? '/admin/economic-finances' : '/admin/finances/economic';
  const scope = { provenance: mode, currency: 'USD', ...(platform ?? {}) };
  const cacheKey = ['captured-finances', actorId, storeId, platform?.kind ?? 'SELLER', platform?.beneficiaryId ?? storeId, mode];
  const storageKey = `economic-payout:${JSON.stringify(cacheKey)}`;
  const balance = useQuery({ queryKey: [...cacheKey, 'overview'], queryFn: () => api.get<CapturedBalance>(`${prefix}/overview`, { params: scope }), retry: false });
  const payouts = useQuery({ queryKey: [...cacheKey, 'payouts', payoutPage], queryFn: () => api.get<EconomicHistory<CapturedPayout>>(`${prefix}/payouts`, { params: { ...scope, page: payoutPage, limit: 20 } }), retry: false });
  const lots = useQuery({ queryKey: [...cacheKey, 'statement', lotPage], queryFn: () => api.get<EconomicHistory<CapturedLot>>(`${prefix}/statement`, { params: { ...scope, page: lotPage, limit: 20 } }), retry: false });
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed: PendingRequest = JSON.parse(saved);
        if (typeof parsed.idempotencyKey !== 'string' || !/^[1-9]\d{0,18}$/.test(parsed.amountMinor)) throw new Error('Invalid saved request');
        setPending(parsed); setAmount(minorToUsdInput(parsed.amountMinor));
      }
      setStorageReady(true);
    } catch { setError('This browser could not restore a pending payout request. Contact support before creating another request.'); }
  }, [storageKey]);
  useEffect(() => {
    if (!confirmation) return;
    const trigger = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    return () => { modal?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [confirmation]);

  const mutation = useMutation({
    mutationFn: async (choice: Confirmation) => {
      if (choice.type === 'request') {
        const request = pending ?? { amountMinor: choice.amountMinor, idempotencyKey: crypto.randomUUID() };
        // Persist before sending. An ambiguous timeout must retry the same request,
        // including after a reload in this tab; don't silently start a second one.
        sessionStorage.setItem(storageKey, JSON.stringify(request)); setPending(request);
        const result = await api.post(`${prefix}/payouts`, { ...request, provenance: mode, currency: 'USD' });
        sessionStorage.removeItem(storageKey); setPending(null); setAmount('');
        return result;
      }
      const reference = choice.payout.transferReference ?? lookupReferences[choice.payout.id] ?? proof.trim();
      if (choice.type === 'verify') setLookupReferences(previous => ({ ...previous, [choice.payout.id]: reference }));
      return api.post(`${prefix}/payouts/${encodeURIComponent(choice.payout.id)}/${choice.type === 'verify' ? 'verify-settlement' : 'reject'}`,
        choice.type === 'verify' ? { reference } : { reason: proof.trim() }, { params: scope });
    },
    onSuccess: (_result, choice) => {
      setMessage(choice.type === 'request' ? 'Payout request recorded. Funds are reserved; no transfer has been sent.'
        : choice.type === 'verify' ? 'Provider evidence verified and settlement recorded.' : 'Request rejected. Only its reserved allocations were released.');
      setError(''); setConfirmation(null);
    },
    onError: () => setError('The action could not be confirmed. Refresh the history and retry the same request or transfer reference; do not send another transfer.'),
    onSettled: () => { submitting.current = false; return qc.invalidateQueries({ queryKey: cacheKey }); },
  });
  const available = balance.data;
  const amountMinor = usdInputToMinor(amount);
  const canRequest = storageReady && !balance.isError && !balance.isFetching && available?.payoutRequestsEnabled
    && amountMinor !== null && BigInt(amountMinor) >= BigInt(available.minimumPayoutMinor) && BigInt(amountMinor) <= BigInt(available.availableMinor);
  function request(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!amountMinor || (!canRequest && !pending)) { setError('Enter an amount within the available balance and payout minimum.'); return; }
    setConfirmation({ type: 'request', amountMinor: pending?.amountMinor ?? amountMinor });
  }
  function open(choice: Confirmation) { setError(''); setProof(''); setConfirmation(choice); }
  function close() { if (!mutation.isPending) setConfirmation(null); }
  return <div className="space-y-6 text-secondary">
    <div className="rounded-card border border-border bg-surface p-4 space-y-2">
      <p className="font-semibold">{mode === 'TEST' ? 'TEST — sandbox funds only' : 'LIVE — verified captured funds'} · USD</p>
      <p className="text-sm">Only verified captures enter this account. Legacy / unknown records are excluded and require reconciliation.</p>
      <p className="text-sm">A payout request reserves money. Settlement is recorded only after provider evidence is verified; these controls do not send transfers.</p>
    </div>
    {balance.isError ? <LoadError retry={() => void balance.refetch()} /> : !available ? <p role="status">Loading verified balance…</p> : <>
      <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {([
          ['Available', available.availableMinor, 'Captured, eligible funds after holds, reservations and debt.'],
          ['Pending eligibility', available.pendingMinor, 'Captured funds awaiting the applicable eligibility conditions.'],
          ['Held', available.heldMinor, 'Not available while an order or account requires review.'],
          ['Reserved for payout', available.reservedMinor, 'Allocated to requested or verifying payouts.'],
          ['Paid out', available.paidMinor, 'Completed settlements backed by provider evidence.'],
          ['Outstanding debt', available.debtMinor, 'Deducted from eligible funds before new reservations.'],
          ...(available.reversedMinor !== undefined ? [['Reversed by refunds', available.reversedMinor, 'Verified original-allocation reversals; paid payout evidence remains unchanged.']] : []),
          ...(available.debtRecoveredMinor !== undefined ? [['Debt recovered', available.debtRecoveredMinor, 'Eligible captured funds retained with immutable audit evidence; no external debit.']] : []),
        ] as const).map(([label, value, description]) => <div key={label} className="border border-border bg-surface rounded-card p-5 min-w-0">
          <dt className="text-sm font-semibold">{label}</dt><dd className="mt-2 text-2xl font-bold tabular-nums break-words">{money(value)}</dd>
          <p className="mt-2 text-sm">{description}</p>
        </div>)}
      </dl>
      {platform && available.debtRecoveryEnabled && <EconomicDebtRecovery kind={platform.kind} beneficiaryId={platform.beneficiaryId} mode={mode} debtMinor={available.debtMinor} />}
      {!platform && <form onSubmit={request} className="border border-border bg-surface rounded-card p-5 space-y-3">
        <h2 className="font-semibold text-lg">Request payout</h2>
        <p className="text-sm">Minimum {money(available.minimumPayoutMinor)}. Recipient details are verified separately; this form cannot change the destination.</p>
        {!available.payoutRequestsEnabled && <p>Payout requests are currently disabled or a verified destination is not configured.</p>}
        {pending && <p role="status">An earlier request is awaiting confirmation. Its amount and request key are locked; retry to recover its result.</p>}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex flex-col gap-2" htmlFor="payout-amount">Amount (USD)
            <input id="payout-amount" className={control} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} readOnly={!!pending} required aria-describedby="payout-feedback" />
          </label>
          <button className={`${control} font-semibold`} disabled={mutation.isPending || !storageReady || (!pending && !canRequest)}>{pending ? 'Retry same request' : 'Review request'}</button>
        </div>
      </form>}
    </>}
    <div id="payout-feedback" aria-live="polite">{message && <p role="status">{message}</p>}{error && <p role="alert" className="text-error">{error}</p>}</div>
    <section aria-labelledby="payout-history-title" className="space-y-4">
      <div className="flex justify-between items-center gap-3"><h2 id="payout-history-title" className="text-lg font-semibold">Payout history</h2>
        <button className={control} onClick={() => void qc.invalidateQueries({ queryKey: cacheKey })}>Refresh</button></div>
      {payouts.isError ? <LoadError retry={() => void payouts.refetch()} /> : !payouts.data ? <p role="status">Loading payouts…</p> : <>
        {!payouts.data.data.length && <p className="p-5 border border-border rounded-card">No payouts in this account and mode.</p>}
        {payouts.data.data.map(row => <article key={row.id} className="border border-border rounded-card bg-surface p-5 space-y-3">
          <div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold break-words">{row.id} · {money(row.amountMinor)}</h3><span className="font-semibold">{row.state}</span></div>
          <p className="text-sm">Requested {new Date(row.createdAt).toLocaleString()}</p>
          {row.state === 'VERIFYING' && <p>Verification is pending. Funds remain reserved; retry the same reference only.</p>}
          {row.transferReference && <p className="text-sm break-words">Transfer reference: {row.transferReference}</p>}
          {row.verificationStartedAt && <p className="text-sm break-words">Verification started {new Date(row.verificationStartedAt).toLocaleString()} · Actor {row.verificationStartedBy}</p>}
          {row.processedAt && <p className="text-sm break-words">Processed {new Date(row.processedAt).toLocaleString()} · Actor {row.processedBy}</p>}
          {row.rejectionReason && <p className="text-sm">Reason: {row.rejectionReason}</p>}
          <details><summary className="cursor-pointer py-2">Exact allocations ({row.allocations.length})</summary>
            <ul className="space-y-2 mt-2">{row.allocations.map(part => <li key={part.lotId} className="text-sm break-words">Capture {part.captureId} / {part.sourceKey} — {money(part.amountMinor)}</li>)}</ul>
          </details>
          {platform && (row.state === 'REQUESTED' || row.state === 'VERIFYING') && <div className="flex flex-wrap gap-3">
            <button className={control} disabled={mutation.isPending} onClick={() => open({ type: 'verify', payout: row })}>{row.state === 'VERIFYING' ? 'Retry verification' : 'Verify settlement'}</button>
            {row.state === 'REQUESTED' && <button className={control} disabled={mutation.isPending} onClick={() => open({ type: 'reject', payout: row })}>Reject request</button>}
          </div>}
        </article>)}
        <PageControls page={payoutPage} total={payouts.data.total} change={setPayoutPage} />
      </>}
    </section>
    <section aria-labelledby="captured-statement-title" className="space-y-4">
      <h2 id="captured-statement-title" className="text-lg font-semibold">Captured allocations</h2>
      <p className="text-sm">Original captured amounts, not a second available balance. Current eligibility is shown in the balance above.</p>
      {lots.isError ? <LoadError retry={() => void lots.refetch()} /> : !lots.data ? <p role="status">Loading captured allocations…</p> : <>
        {!lots.data.data.length && <p>No verified captures in this account and mode.</p>}
        {lots.data.data.map(row => <details key={row.id} className="p-4 border border-border bg-surface rounded-card">
          <summary className="cursor-pointer break-words">Order {row.orderId} — {money(row.capturedMinor)}</summary>
          <dl className="mt-3 space-y-2 text-sm break-words"><div><dt>Capture / source</dt><dd>{row.captureId} / {row.sourceKey}</dd></div>
            <div><dt>Reserved / paid</dt><dd>{money(row.reservedMinor)} / {money(row.paidMinor)}</dd></div>
            {row.reversedMinor !== undefined && <div><dt>Refund reversal</dt><dd>{money(row.reversedMinor)}</dd></div>}
            {row.debtRecoveredMinor !== undefined && <div><dt>Retained for debt recovery</dt><dd>{money(row.debtRecoveredMinor)}</dd></div>}
            {row.holdReason && <div><dt>Hold reason</dt><dd>{row.holdReason}</dd></div>}
          </dl></details>)}
        <PageControls page={lotPage} total={lots.data.total} change={setLotPage} />
      </>}
    </section>
    {confirmation && <dialog ref={dialog} onCancel={event => { if (mutation.isPending) event.preventDefault(); else close(); }} onClose={close}
      aria-labelledby="payout-confirm-title" style={{ margin: 'auto', width: 'calc(100% - 2rem)', maxHeight: 'calc(100dvh - 2rem)' }} className="rounded-card border border-border bg-surface text-secondary p-6 max-w-lg overflow-y-auto backdrop:bg-black/50">
      <form onSubmit={event => { event.preventDefault(); if (!submitting.current) { submitting.current = true; mutation.mutate(confirmation); } }} className="space-y-4">
        <h2 id="payout-confirm-title" className="text-xl font-semibold">{confirmation.type === 'request' ? 'Confirm payout request' : confirmation.type === 'reject' ? 'Reject payout request' : 'Verify existing transfer'}</h2>
        <p>{mode} · {money(confirmation.type === 'request' ? confirmation.amountMinor : confirmation.payout.amountMinor)} USD</p>
        {confirmation.type === 'request' ? <p>This reserves the exact amount. It does not send a transfer.</p> : confirmation.type === 'verify' ? <>
          <p>Only use an existing transfer with this payout ID in its provider metadata. Once verification starts, the reference cannot be changed or the reservation released without reconciliation.</p>
          <label className="block" htmlFor="payout-proof">Transfer reference
            <input id="payout-proof" className={`${control} w-full mt-2`} value={confirmation.payout.transferReference ?? lookupReferences[confirmation.payout.id] ?? proof} onChange={e => setProof(e.target.value)} readOnly={!!(confirmation.payout.transferReference ?? lookupReferences[confirmation.payout.id])} pattern="[A-Za-z0-9_]{1,150}" required />
          </label>
        </> : <label className="block" htmlFor="payout-proof">Reason
          <input id="payout-proof" className={`${control} w-full mt-2`} value={proof} onChange={e => setProof(e.target.value)} maxLength={500} required />
        </label>}
        {error && <p role="alert" className="text-error">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={control} disabled={mutation.isPending} onClick={close}>Cancel</button>
          <button className={`${control} font-semibold`} disabled={mutation.isPending || (confirmation.type === 'reject' && !proof.trim())}>{mutation.isPending ? 'Checking…' : 'Confirm'}</button>
        </div>
      </form>
    </dialog>}
  </div>;
}
