import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RefundExpectation, RefundProvider, refundReference, verifyRefundEvidence } from '../payments/economic-refund-evidence';
import { economicTransaction } from './economic-balance';
import { appendEconomicEvent, claimEconomicOperation, markEconomicOperationAmbiguous } from './economic-durability';
import { EconomicQuote, canonicalEconomicJson, exactMinor } from './economic-quote';
import { EconomicRefundPlan, exactSignedMinor, refundLotImpact } from './economic-refund-plan';
import { plannedRefundJournal } from './economic-refund-journal';

type Database = Pick<PrismaClient, '$transaction' | 'economicRefundRequest' | 'economicOperation' | 'economicOutbox'>;

/** Dispatch once, retrieve on every retry; unknown outcomes never permit another
 * write. A recovery reference is only a lookup hint, verified against the frozen
 * capture, request metadata, account, mode, amount and original provider resource. */
export async function executeEconomicRefund(db: Database, requestId: string, actorId: string,
  provider: RefundProvider, recoveryReference?: string) {
  if (!actorId || actorId !== actorId.trim() || actorId.length > 150) throw new Error('Refund verifier identity required');
  const before = await db.economicRefundRequest.findUniqueOrThrow({ where: { id: requestId }, include: {
    operation: true, settlement: true, capture: { include: { context: { include: { order: { include: { payment: true } } } } } },
  } });
  const op = before.operation, capture = before.capture, payment = capture.context.order.payment;
  if (provider.provider !== capture.provider || provider.providerAccount !== capture.providerAccount
    || provider.provenance !== capture.provenance || op.kind !== 'REFUND' || !payment) throw new Error('Refund scope mismatch');
  if (op.state === 'FAILED') throw new ConflictException('Refund is already terminal');
  if (op.state === 'SUCCEEDED') {
    if (!before.settlement || (recoveryReference && recoveryReference !== before.settlement.providerReference)) throw new ConflictException('Refund proof/reference mismatch');
    return { id: before.settlement.id, requestId, state: 'SUCCEEDED' as const, amountMinor: before.settlement.amountMinor.toString() };
  }
  const paymentReference = capture.provider === 'STRIPE' ? payment.stripePaymentIntentId : payment.paypalOrderId;
  if (!paymentReference) throw new Error('Original payment binding is missing');
  const base: Omit<RefundExpectation, 'refundReference'> = { operationId: op.id, captureId: capture.id,
    captureOperationId: capture.operationId, quoteHash: capture.quoteHash, orderId: capture.context.orderId,
    provider: capture.provider, providerAccount: capture.providerAccount, provenance: capture.provenance,
    captureReference: capture.providerReference, paymentReference, currency: capture.currency,
    minorExponent: capture.context.minorExponent, amountMinor: op.amountMinor.toString(), capturedMinor: capture.amountMinor.toString() };
  if (recoveryReference) refundReference(capture.provider, recoveryReference);
  if (op.providerReference && recoveryReference && op.providerReference !== recoveryReference) throw new ConflictException('Refund lookup is already bound');
  if (op.state === 'PREPARED' && recoveryReference) throw new ConflictException('An undispatched refund cannot be recovered');
  const token = await claimEconomicOperation(db, op.id);
  let reference = op.providerReference ?? recoveryReference;
  try {
    if (token) reference = refundReference(capture.provider, await provider.create(base));
    if (!reference) throw new ConflictException('Unknown refund outcome: provide the original refund reference for verification; do not redispatch');
    reference = refundReference(capture.provider, reference);
    // Only a trusted create response may bind an unverified pending reference.
    // A mistyped recovery hint must not permanently poison the original request.
    if (token) {
      const bound = await db.economicOperation.updateMany({ where: { id: op.id, state: { in: ['DISPATCHED', 'NEEDS_RECONCILIATION'] },
        OR: [{ providerReference: null }, { providerReference: reference }] }, data: { providerReference: reference } });
      if (bound.count !== 1) throw new ConflictException('Refund lookup changed; reload reconciliation');
    }
    const expected: RefundExpectation = { ...base, refundReference: reference };
    const verifiedReference = reference;
    const evidenceHash = verifyRefundEvidence(await provider.read(expected), expected, provider);
    return await economicTransaction(db, async tx => {
      await tx.$queryRaw`SELECT "id" FROM "EconomicCapture" WHERE "id" = ${capture.id} FOR UPDATE`;
      const request = await tx.economicRefundRequest.findUniqueOrThrow({ where: { id: requestId }, include: { operation: true, settlement: true } });
      if (request.settlement) {
        if (request.settlement.evidenceHash !== evidenceHash) throw new ConflictException('Refund evidence changed');
        return { id: request.settlement.id, requestId, state: 'SUCCEEDED' as const, amountMinor: request.settlement.amountMinor.toString() };
      }
      if (request.captureId !== capture.id || request.operationId !== op.id || (request.operation.providerReference && request.operation.providerReference !== reference)
        || !['DISPATCHED', 'NEEDS_RECONCILIATION'].includes(request.operation.state)) throw new ConflictException('Refund identity/state changed');
      const plan = request.plan as unknown as EconomicRefundPlan;
      const quote = capture.context.quote as unknown as EconomicQuote;
      const journal = plannedRefundJournal(plan, quote);
      if (canonicalEconomicJson(journal) !== canonicalEconomicJson(request.plannedJournal)
        || request.platformRoundingMinor !== exactSignedMinor(plan.platformRoundingMinor)) throw new Error('Refund plan requires reconciliation');
      const amounts = new Map(plan.parts.filter(p => exactMinor(p.sellerNetMinor) > 0n).map(p => [p.partKey, exactMinor(p.sellerNetMinor)]));
      if (exactMinor(plan.affiliateMinor) > 0n) amounts.set('affiliate-pending', exactMinor(plan.affiliateMinor));
      const lots = await tx.economicBalanceLot.findMany({ where: { captureId: capture.id, sourceKey: { in: [...amounts.keys()] } }, orderBy: [{ accountId: 'asc' }, { id: 'asc' }] });
      if (lots.length !== amounts.size) throw new Error('Refund beneficiary lots missing');
      for (const accountId of [...new Set(lots.map(l => l.accountId))]) {
        await tx.$queryRaw`SELECT "id" FROM "EconomicBalanceAccount" WHERE "id" = ${accountId} FOR UPDATE`;
      }
      const now = new Date();
      const completed = await tx.economicOperation.updateMany({ where: { id: op.id, OR: [{ providerReference: reference }, { providerReference: null }],
        state: { in: ['DISPATCHED', 'NEEDS_RECONCILIATION'] } }, data: { state: 'SUCCEEDED', providerReference: reference, completedAt: now } });
      if (completed.count !== 1) throw new ConflictException('Refund state changed');
      const refund = await tx.economicRefund.create({ data: { requestId, providerReference: verifiedReference,
        evidenceHash, amountMinor: op.amountMinor, verifiedAt: now, verifiedBy: actorId } });
      await tx.economicRefundJournalEntry.createMany({ data: journal.map(j => ({ refundId: refund.id,
        entryKey: j.entryKey, account: j.account, beneficiaryId: j.beneficiaryId ?? null,
        currency: capture.currency, amountMinor: exactSignedMinor(j.amountMinor) })) });
      for (const lot of lots) {
        const reversal = amounts.get(lot.sourceKey);
        if (reversal === undefined) throw new Error('Refund original lot allocation missing');
        // Retained debt-recovery funds are as unavailable as already-paid funds.
        const impact = refundLotImpact({ amount: lot.amountMinor, paid: lot.paidMinor + lot.debtRecoveredMinor,
          reserved: lot.reservedMinor, previouslyReversed: lot.reversedMinor, reversal });
        await tx.economicRefundLotReversal.create({ data: { refundId: refund.id, lotId: lot.id,
          amountMinor: reversal, availableDebitMinor: impact.availableDebit, debtMinor: impact.debt } });
        await tx.economicBalanceLot.update({ where: { id: lot.id }, data: { reversedMinor: impact.reversed } });
        if (impact.debt > 0n) await tx.economicBalanceAccount.update({ where: { id: lot.accountId }, data: { debtMinor: { increment: impact.debt } } });
      }
      await appendEconomicEvent(tx, { contextId: capture.contextId, eventType: 'refund.verified.v1', operationId: op.id,
        eventKey: `refund:${op.id}:${verifiedReference}` });
      // A partial refund does not overwrite order progress or pretend stock was returned.
      return { id: refund.id, requestId, state: 'SUCCEEDED' as const, amountMinor: refund.amountMinor.toString() };
    });
  } catch (error) {
    if (token) await markEconomicOperationAmbiguous(db, op.id, token);
    else await db.economicOperation.updateMany({ where: { id: op.id, state: 'DISPATCHED' }, data: { state: 'NEEDS_RECONCILIATION' } });
    throw error;
  }
}
