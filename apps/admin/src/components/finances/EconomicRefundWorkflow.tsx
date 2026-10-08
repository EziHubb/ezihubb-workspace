'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { formatCapturedUsd, MoneyMode, usdInputToMinor } from '../../lib/economic-finances';

type Request = { id: string; state: string; amountMinor: string; reason: string; requestedBy?: string; providerReference: string | null;
  giftWrapApproval?: { approvedBy: string; reason: string } | null;
  shippingEligibility?: { policy: string; storeOrderIds: string[] } | null;
  shippingOverrideApproval?: { approvedBy: string; reason: string; evidenceReference: string; amountMinor: string } | null };
type Options = { version: 'economic-v1'; captureId: string; provenance: MoneyMode; currency: string; writesEnabled: boolean;
  lines: { partKey: string; kind?: 'ITEM' | 'GIFT_WRAP' | 'SHIPPING'; storeId: string; originalQuantity: number; remainingQuantity: number; customerMinor: string; remainingCustomerMinor?: string; shippingEligible?: boolean }[];
  unresolvedRequest: Request | null };
const control = 'min-h-11 rounded-button border border-border px-3 py-2 bg-surface text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';

/** Separate audited workflow. Preparing does not refund; the second explicit
 * confirmation dispatches at most once. Ambiguous requests retain identity. */
export function EconomicRefundWorkflow({ captureId, mode, actorId }: { captureId: string; mode: MoneyMode; actorId: string }) {
  const qc = useQueryClient(), dialog = useRef<HTMLDialogElement>(null), submitting = useRef(false);
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [reference, setReference] = useState('');
  const [selection, setSelection] = useState<Record<string, number>>({}), [request, setRequest] = useState<Request | null>(null);
  const [locked, setLocked] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [approveGiftWrap, setApproveGiftWrap] = useState(false);
  const [shippingException, setShippingException] = useState(false), [shippingPart, setShippingPart] = useState('');
  const [shippingAmount, setShippingAmount] = useState(''), [shippingEvidence, setShippingEvidence] = useState('');
  const errorSummary = useRef<HTMLParagraphElement>(null);
  const scope = { provenance: mode, currency: 'USD' };
  const cacheKey = ['economic-refund-options', actorId, captureId, mode];
  const storageKey = `economic-refund-request:${actorId}:${captureId}:${mode}`;
  const options = useQuery({ queryKey: cacheKey, enabled: open, retry: false,
    queryFn: () => api.get<Options>(`/admin/economic-finances/captures/${encodeURIComponent(captureId)}/refund-options`, { params: scope }) });
  const data = options.data;
  const valid = data?.version === 'economic-v1' && data.captureId === captureId && data.provenance === mode && data.currency === 'USD'
    && typeof data.writesEnabled === 'boolean' && Array.isArray(data.lines) && data.lines.every(line => line && typeof line.partKey === 'string'
      && [undefined, 'ITEM', 'GIFT_WRAP', 'SHIPPING'].includes(line.kind)
      && (line.kind !== 'SHIPPING' || typeof line.shippingEligible === 'boolean')
      && Number.isSafeInteger(line.remainingQuantity) && line.remainingQuantity >= 0 && /^\d+$/.test(line.customerMinor));
  const pending = (valid ? data.unresolvedRequest : null) ?? request;
  const pendingValid = !pending || (typeof pending.id === 'string' && /^[1-9]\d*$/.test(pending.amountMinor)
    && ['PREPARED', 'DISPATCHED', 'NEEDS_RECONCILIATION'].includes(pending.state)
    && (!pending.shippingOverrideApproval || (typeof pending.shippingOverrideApproval.approvedBy === 'string'
      && !!pending.shippingOverrideApproval.approvedBy.trim() && typeof pending.shippingOverrideApproval.evidenceReference === 'string'
      && !!pending.shippingOverrideApproval.evidenceReference.trim() && typeof pending.shippingOverrideApproval.reason === 'string'
      && pending.shippingOverrideApproval.reason === pending.reason && typeof pending.shippingOverrideApproval.amountMinor === 'string'
      && pending.shippingOverrideApproval.amountMinor === pending.amountMinor)));
  const canWrite = valid && pendingValid && data.writesEnabled && !options.isError && !options.isFetching;
  const selectsGiftWrap = valid && data.lines.some(line => line.kind === 'GIFT_WRAP' && (selection[line.partKey] ?? 0) > 0);
  const overrideLines = valid ? data.lines.flatMap(line => line.kind === 'SHIPPING'
    && typeof line.remainingCustomerMinor === 'string' && /^[1-9]\d*$/.test(line.remainingCustomerMinor)
    && BigInt(line.remainingCustomerMinor) <= BigInt(line.customerMinor) ? [{ ...line, remainingCustomerMinor: line.remainingCustomerMinor }] : []) : [];
  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const currentDialog = dialog.current;
    currentDialog?.showModal();
    return () => { currentDialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [open]);
  const mutation = useMutation({ mutationFn: async () => {
    if (!canWrite) throw new Error('Refund writing is unavailable for this scope');
    if (pending) {
      const lookup = pending.providerReference ?? reference.trim();
      return api.post<{ state: string }>(`/admin/economic-finances/refund-requests/${encodeURIComponent(pending.id)}/execute`,
        lookup ? { reference: lookup } : {}, { params: scope });
    }
    const lines = data.lines.filter(line => (selection[line.partKey] ?? 0) > 0).map(line => ({ partKey: line.partKey, quantity: selection[line.partKey] }));
    const amountMinor = usdInputToMinor(shippingAmount);
    if (!reason.trim()) throw new Error('Enter an audit reason');
    if (shippingException) {
      const original = overrideLines.find(line => line.partKey === shippingPart);
      if (!original || !amountMinor || !original.remainingCustomerMinor || BigInt(amountMinor) > BigInt(original.remainingCustomerMinor)) {
        throw new Error('Choose original shipping and enter a positive USD amount no greater than its remaining customer-paid amount');
      }
      if (!shippingEvidence.trim()) throw new Error('Enter an audit evidence reference for this separately approved shipping exception');
    } else if (!lines.length) throw new Error('Choose quantities and an audit reason');
    if (!shippingException && data.lines.some(line => line.kind === 'SHIPPING' && (selection[line.partKey] ?? 0) > 0
      && (!line.shippingEligible || data.lines.some(item => item.kind === 'ITEM' && item.storeId === line.storeId
        && (selection[item.partKey] ?? 0) !== item.remainingQuantity)))) {
      throw new Error('Shipping requires a cancelled shop before handoff and refunding all remaining original shop items');
    }
    if (!shippingException && selectsGiftWrap && !approveGiftWrap) throw new Error('Gift wrap requires separate super admin approval');
    const idempotencyKey = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
    // Only a non-secret request identity is persisted, never reason/customer data.
    sessionStorage.setItem(storageKey, idempotencyKey); setLocked(true);
    const created = await api.post<Pick<Request, 'id' | 'state' | 'amountMinor' | 'giftWrapApproval' | 'shippingEligibility' | 'shippingOverrideApproval'>>(
      `/admin/economic-finances/captures/${encodeURIComponent(captureId)}/${shippingException ? 'shipping-refund-override' : 'refund-requests'}`,
      shippingException ? { reason: reason.trim(), idempotencyKey, partKey: shippingPart, amountMinor, evidenceReference: shippingEvidence.trim() }
        : { reason: reason.trim(), idempotencyKey, selection: lines, ...(selectsGiftWrap && approveGiftWrap ? { approveGiftWrap: true } : {}) }, { params: scope });
    setRequest({ ...created, reason: reason.trim(), providerReference: null });
    return { state: 'PREPARED' };
  }, onSuccess: result => {
    setError('');
    if (result.state === 'SUCCEEDED') {
      sessionStorage.removeItem(storageKey); setRequest(null); setLocked(false); setSelection({}); setReason(''); setApproveGiftWrap(false);
      setShippingException(false); setShippingPart(''); setShippingAmount(''); setShippingEvidence('');
      setMessage('Provider refund evidence verified. The compensating journal and any debt are recorded; paid payout history is unchanged.');
    } else setMessage('Refund plan recorded. No money was refunded. Review the original amount and confirm execution below.');
  }, onError: failure => setError(failure instanceof Error ? failure.message : 'Refund outcome unknown. Recover this request; do not create another.'),
    onSettled: async () => {
      submitting.current = false;
      await Promise.all([qc.invalidateQueries({ queryKey: cacheKey }), qc.invalidateQueries({ queryKey: ['economic-reconciliation'] }),
        qc.invalidateQueries({ queryKey: ['captured-finances'] }), qc.invalidateQueries({ queryKey: ['economic-summary'] })]);
    } });
  function close() { if (!mutation.isPending) setOpen(false); }
  return <div>
    <button type="button" className={control} onClick={() => setOpen(true)}>Review original refund</button>
    {open && <dialog ref={dialog} aria-labelledby={`refund-title-${captureId}`} onCancel={event => { if (mutation.isPending) event.preventDefault(); else close(); }} onClose={close}
      style={{ margin: 'auto', width: 'calc(100% - 2rem)', maxHeight: 'calc(100dvh - 2rem)' }}
      className="max-w-xl overflow-y-auto rounded-card border border-border bg-surface p-5 text-secondary backdrop:bg-black/50">
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!submitting.current && canWrite) { submitting.current = true; mutation.mutate(); } }}>
        <h2 id={`refund-title-${captureId}`} className="text-xl font-semibold">{pending ? 'Confirm original refund execution' : 'Prepare original-allocation refund'}</h2>
        <p className="break-all text-sm">{mode} · USD · Capture {captureId}</p>
        <p className="text-sm">Refund is not returned-stock evidence. No automatic restock or deletion of a paid payout occurs.</p>
        {options.isFetching && <p role="status">Loading original allocations…</p>}
        {(options.isError || (data && (!valid || !pendingValid))) && <div role="alert"><p>Original allocations could not be verified. Actions are blocked.</p>
          <button type="button" className={control} onClick={() => void options.refetch()}>Retry original allocations</button></div>}
        {valid && !data.writesEnabled && <p role="status">Refund writes are disabled for this environment. Viewing does not dispatch a refund.</p>}
        {canWrite && pending ? <div className="space-y-3">
          <p className="text-lg font-semibold">{formatCapturedUsd(pending.amountMinor)} · {pending.state}</p>
          <p className="break-words">Audit reason: {pending.reason}</p>
          <p className="break-all text-sm">Request {pending.id} · Actor {pending.requestedBy ?? actorId}</p>
          {pending.giftWrapApproval && <p>Gift wrap refund explicitly approved by {pending.giftWrapApproval.approvedBy}. Reason: {pending.giftWrapApproval.reason}</p>}
          {pending.shippingEligibility && <p>Original customer-paid shipping included under the full-shop cancellation before handoff policy. Platform shipping support is not refunded as seller credit.</p>}
          {pending.shippingOverrideApproval && <div className="space-y-2 rounded-card border border-border p-3">
            <p>Shipping exception explicitly approved by {pending.shippingOverrideApproval.approvedBy} for {formatCapturedUsd(pending.shippingOverrideApproval.amountMinor)}.</p>
            <p className="break-words">Audit reference: {pending.shippingOverrideApproval.evidenceReference}</p>
            <p className="text-sm">This reference records the administrator’s decision, not provider proof. The original provider refund still requires independent verification.</p>
          </div>}
          <p>{pending.state === 'PREPARED' ? 'Confirming now sends one refund to the original payment provider. This cannot be undone.'
            : 'This request was already dispatched. Confirmation only retrieves its existing provider evidence; it never sends another refund.'}</p>
          {pending.state !== 'PREPARED' && <label htmlFor={`refund-reference-${captureId}`} className="block space-y-2">Original provider refund reference
            <input id={`refund-reference-${captureId}`} className={`${control} w-full`} value={pending.providerReference ?? reference} onChange={event => setReference(event.target.value)}
              readOnly={!!pending.providerReference} required pattern="[A-Za-z0-9_]{1,150}" maxLength={150} /></label>}
        </div> : canWrite && <div className="space-y-3">
          <p className="text-sm">Original allocations only. Automatic shipping eligibility requires full shop cancellation before handoff. Gift wrap and shipping exceptions need separate super admin approval. Tax-bearing refunds and goodwill remain blocked.</p>
          {!!overrideLines.length && <label className="flex min-h-11 items-start gap-3 rounded-card border border-border p-3" htmlFor={`shipping-exception-${captureId}`}>
            <input id={`shipping-exception-${captureId}`} type="checkbox" className="mt-1" checked={shippingException} disabled={locked}
              onChange={event => { setShippingException(event.target.checked); setError(''); }} />
            <span>I separately approve a shipping exception as super admin, including partial refunds or refunds after handoff.</span>
          </label>}
          {shippingException ? <fieldset className="space-y-3">
            <legend className="font-semibold">Separately approved customer-paid shipping</legend>
            <p className="text-sm">Only the original remaining shipping charge may be refunded. Platform support is not a seller credit. This request cannot include merchandise or gift wrap.</p>
            <label className="block space-y-2" htmlFor={`shipping-part-${captureId}`}>Original shipping allocation
              <select id={`shipping-part-${captureId}`} className={`${control} w-full`} value={shippingPart} disabled={locked} required onChange={event => setShippingPart(event.target.value)}>
                <option value="">Choose original shipping</option>
                {overrideLines.map(line => <option key={line.partKey} value={line.partKey}>{line.partKey} · Remaining {formatCapturedUsd(line.remainingCustomerMinor)}</option>)}
              </select>
            </label>
            <label className="block space-y-2" htmlFor={`shipping-amount-${captureId}`}>Approved shipping refund (USD)
              <input id={`shipping-amount-${captureId}`} className={`${control} w-full`} inputMode="decimal" value={shippingAmount}
                readOnly={locked} required maxLength={20} onChange={event => setShippingAmount(event.target.value)} aria-describedby={`shipping-limit-${captureId}`} />
            </label>
            <p id={`shipping-limit-${captureId}`} className="text-sm">Use up to two decimal places. Server verification rechecks the remaining original charge before recording this plan.</p>
            <label className="block space-y-2" htmlFor={`shipping-evidence-${captureId}`}>Audit evidence reference
              <input id={`shipping-evidence-${captureId}`} className={`${control} w-full`} value={shippingEvidence} required maxLength={150}
                readOnly={locked} onChange={event => setShippingEvidence(event.target.value)} />
            </label>
          </fieldset> : data.lines.map(line => <label key={line.partKey} htmlFor={`refund-line-${captureId}-${line.partKey}`} className="block space-y-2 border-b border-border pb-3">
            <span className="block break-all text-sm">{line.kind === 'GIFT_WRAP' ? 'Gift wrap · ' : line.kind === 'SHIPPING' ? 'Customer-paid shipping · ' : ''}{line.partKey} · Store {line.storeId} · {line.remainingQuantity} units remaining</span>
            {line.kind === 'SHIPPING' && <span className="block text-sm">{line.shippingEligible ? 'Eligible before handoff; select all remaining shop items too.' : 'Unavailable: cancellation before handoff cannot be verified.'}</span>}
            <input id={`refund-line-${captureId}-${line.partKey}`} type="number" className={`${control} w-28`} min={0} max={line.remainingQuantity} step={1} disabled={locked || !line.remainingQuantity || (line.kind === 'SHIPPING' && !line.shippingEligible)}
              value={selection[line.partKey] ?? 0} onChange={event => setSelection(previous => ({ ...previous, [line.partKey]: Number(event.target.value) }))} />
          </label>)}
          {!shippingException && selectsGiftWrap && <label htmlFor={`gift-wrap-approval-${captureId}`} className="flex items-start gap-3 rounded-card border border-border p-3">
            <input id={`gift-wrap-approval-${captureId}`} type="checkbox" className="mt-1" checked={approveGiftWrap} disabled={locked}
              onChange={event => setApproveGiftWrap(event.target.checked)} />
            <span>I separately approve refunding the selected original gift wrap fee as super admin. My identity and audit reason will be recorded.</span>
          </label>}
          <label htmlFor={`refund-reason-${captureId}`} className="block space-y-2">Audit reason
            <textarea id={`refund-reason-${captureId}`} className={`${control} w-full`} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} required readOnly={locked} /></label>
        </div>}
        {error && <p ref={errorSummary} tabIndex={-1} role="alert" className="break-words text-error">{error}</p>}
        {message && <p role="status">{message}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={control} disabled={mutation.isPending} onClick={close}>Close refund review</button>
          <button type="submit" className={`${control} font-semibold`} disabled={mutation.isPending || !canWrite || (!pending && !shippingException && selectsGiftWrap && !approveGiftWrap)}>
            {mutation.isPending ? 'Verifying request…' : pending ? pending.state === 'PREPARED' ? 'Confirm refund execution' : 'Verify existing refund' : locked ? 'Retry same refund plan' : 'Prepare refund plan'}
          </button>
        </div>
      </form>
    </dialog>}
  </div>;
}
