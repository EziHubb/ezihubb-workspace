import { ConflictException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { economicTransaction } from './economic-balance';
import { prepareEconomicOperation } from './economic-durability';
import { EconomicQuote, exactMinor } from './economic-quote';
import { EconomicRefundPlan, exactSignedMinor, GIFT_WRAP_REFUND_POLICY, planQuantityRefund, planShippingOverride, refundRequestHash, RefundSelection, ShippingOverrideInput, shippingOverrideRequestHash } from './economic-refund-plan';
import { plannedRefundJournal } from './economic-refund-journal';
import { verifiedShippingRefundEligibility } from './economic-shipping-refund';

/** Actor/provenance/tenant checks precede this in the authorized controller.
 * An immutable intent is still not evidence of refunded money. */
export async function prepareQuantityRefund(db: Pick<PrismaClient, '$transaction'>, input: {
  captureId: string; actorId: string; reason: string; idempotencyKey: string; selection: RefundSelection[]; approveGiftWrap?: boolean;
  shippingOverride?: ShippingOverrideInput;
}) {
  if (input.shippingOverride && (input.selection.length || input.approveGiftWrap)) throw new Error('Shipping exception must be approved separately');
  const requestHash = input.shippingOverride ? shippingOverrideRequestHash({ ...input.shippingOverride,
    captureId: input.captureId, actorId: input.actorId, reason: input.reason }) : refundRequestHash(input);
  if (!/^[A-Za-z0-9:_-]{1,80}$/.test(input.idempotencyKey)) throw new Error('Invalid refund request key');
  return economicTransaction(db, async tx => {
    const capture = await tx.economicCapture.findUniqueOrThrow({ where: { id: input.captureId }, include: { context: true } });
    await tx.$queryRaw`SELECT "id" FROM "EconomicCapture" WHERE "id" = ${capture.id} FOR UPDATE`;
    // Namespaced by capture: the same client key cannot accidentally bind another order.
    const key = `${capture.id}:${input.idempotencyKey}`;
    const requests = await tx.economicRefundRequest.findMany({ where: { captureId: capture.id }, include: { operation: true, settlement: true }, orderBy: { createdAt: 'asc' } });
    const prior = requests.find(r => r.operation.idempotencyKey === key);
    if (prior) {
      if (prior.operation.requestHash !== requestHash) throw new ConflictException('Refund key reused with different details');
      return prior;
    }
    const operations = await tx.economicOperation.findMany({ where: { contextId: capture.contextId, kind: 'REFUND', state: { not: 'FAILED' } } });
    if (operations.some(op => op.state !== 'SUCCEEDED' || !requests.some(r => r.operationId === op.id && r.settlement))) {
      throw new ConflictException('Resolve the existing refund before requesting another');
    }
    const previous = new Map<string, number>();
    const shippingAmounts = new Map<string, bigint>();
    const shippingExceptions = new Set<string>();
    for (const request of requests.filter(r => r.operation.state === 'SUCCEEDED' && r.settlement)) {
      const plan = request.plan as unknown as EconomicRefundPlan;
      if (plan.quoteHash !== capture.quoteHash || !['refund-v1', 'shipping-override-v1'].includes(plan.version)) throw new Error('Refund history requires reconciliation');
      for (const part of plan.parts) {
        shippingAmounts.set(part.partKey, (shippingAmounts.get(part.partKey) ?? 0n) + exactMinor(part.customerMinor));
        if (plan.version === 'shipping-override-v1') shippingExceptions.add(part.partKey);
        else previous.set(part.partKey, (previous.get(part.partKey) ?? 0) + part.quantity);
      }
    }
    const quote = capture.context.quote as unknown as EconomicQuote;
    if (!input.shippingOverride && input.selection.some(row => shippingExceptions.has(row.partKey))) {
      throw new ConflictException('Remaining shipping after an exception requires another separate approval');
    }
    const shippingEligibility = input.shippingOverride ? undefined : await verifiedShippingRefundEligibility(tx, capture.contextId, quote, input.selection, previous);
    const plan = input.shippingOverride ? planShippingOverride(quote, input.shippingOverride,
      (shippingAmounts.get(input.shippingOverride.partKey) ?? 0n).toString(), input.actorId, input.reason)
      : planQuantityRefund(quote, input.selection, previous, input.approveGiftWrap === true
        ? { policy: GIFT_WRAP_REFUND_POLICY, approvedBy: input.actorId, reason: input.reason } : undefined, shippingEligibility);
    const plannedJournal = plannedRefundJournal(plan, quote);
    // Acquire the same account locks as payout, in deterministic order. Until
    // exact refund settlement lands, any existing payout reservation blocks this
    // preparatory path rather than releasing money with an uncertain outcome.
    const lots = await tx.economicBalanceLot.findMany({ where: { captureId: capture.id }, orderBy: { accountId: 'asc' } });
    for (const id of [...new Set(lots.map(lot => lot.accountId))]) {
      await tx.$queryRaw`SELECT "id" FROM "EconomicBalanceAccount" WHERE "id" = ${id} FOR UPDATE`;
    }
    if (lots.some(lot => lot.reservedMinor > 0n)) throw new ConflictException('Resolve reserved payouts before requesting a refund');
    const operation = await prepareEconomicOperation(tx, { contextId: capture.contextId,
      provenance: capture.provenance, currency: capture.currency, provider: capture.provider,
      providerAccount: capture.providerAccount, kind: 'REFUND', idempotencyKey: key,
      requestHash, amountMinor: exactMinor(plan.customerMinor) });
    return tx.economicRefundRequest.create({ data: { captureId: capture.id, operationId: operation.id,
      requestedBy: input.actorId, reason: input.reason, plan: plan as unknown as Prisma.InputJsonValue,
      platformRoundingMinor: exactSignedMinor(plan.platformRoundingMinor),
      plannedJournal: plannedJournal as unknown as Prisma.InputJsonValue }, include: { operation: true } });
  });
}
