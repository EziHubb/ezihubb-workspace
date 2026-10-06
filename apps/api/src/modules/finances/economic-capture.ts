import { EconomicProvenance, Prisma, PrismaClient } from '@prisma/client';
import { appendEconomicEvent } from './economic-durability';
import { buildEconomicQuote, EconomicQuote, exactMinor, QuoteInput, quoteFingerprint } from './economic-quote';
import { captureJournal } from './economic-journal';
import { seedCapturedBalanceLots } from './economic-balance';
import { ECONOMIC_POLICY_VERSION, parseMinorUnits } from './economic-policy';
import {
  CaptureEvidence, CaptureExpectation, paypalCaptureEvidence, ProviderReadScope, stripeCaptureEvidence,
} from '../payments/economic-capture-evidence';

type Database = Pick<PrismaClient, '$transaction' | 'economicOperation' | 'payment'>;

async function assertOrderMatchesQuote(tx: Prisma.TransactionClient, quote: EconomicQuote) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: quote.orderId }, include: { items: true, storeOrders: true, payment: true },
  });
  if (parseMinorUnits(order.total.toString(), quote.minorExponent) !== exactMinor(quote.customerTotalMinor)
    || order.items.length !== quote.parts.filter(part => part.kind === 'ITEM').length
    || order.storeOrders.length !== quote.stores.length) throw new Error('Order no longer matches its economic quote');
  for (const store of quote.stores) {
    const storeOrder = order.storeOrders.find(row => row.id === store.storeOrderId && row.storeId === store.storeId);
    if (!storeOrder) throw new Error('Quote contains a foreign store order');
    for (const line of store.lines) {
      const item = order.items.find(row => row.id === line.id);
      if (!item || item.storeOrderId !== store.storeOrderId || item.storeId !== store.storeId
        || item.productId !== line.productId || item.variantId !== line.variantId || item.quantity !== line.quantity
        || parseMinorUnits(item.unitPrice.toString(), quote.minorExponent) !== exactMinor(line.unitPriceMinor)) {
        throw new Error('Quote contains a foreign or changed order line');
      }
    }
  }
  if (order.payment && (order.payment.giftCardCode || order.payment.method === 'MIXED' || order.payment.method === 'GIFT_CARD')) {
    throw new Error('Split/gift-card payment requires explicit tender allocations');
  }
  return order;
}

/** Invoke only from the new checkout transaction, never to backfill an old order. */
export async function persistEconomicQuote(tx: Prisma.TransactionClient, input: QuoteInput, provenance: EconomicProvenance) {
  const quote = buildEconomicQuote(input);
  const hash = quoteFingerprint(quote);
  const order = await assertOrderMatchesQuote(tx, quote);
  const previous = await tx.economicOrderContext.findUnique({ where: { orderId: input.orderId } });
  if (previous) {
    if (previous.quoteHash !== hash || previous.provenance !== provenance) throw new Error('Order quote is already frozen');
    return previous;
  }
  if (order.status !== 'PENDING_PAYMENT' || (order.payment && order.payment.status !== 'PENDING')) {
    throw new Error('Only a new unpaid online order can acquire an economic context');
  }
  const legacyCredits = await tx.sellerLedgerEntry.count({ where: { storeOrder: { orderId: order.id } } });
  if (legacyCredits !== 0) throw new Error('Legacy financial records require separate reconciliation');
  return tx.economicOrderContext.create({ data: {
    orderId: order.id, provenance, currency: quote.currency, minorExponent: quote.minorExponent,
    policyVersion: ECONOMIC_POLICY_VERSION, quoteHash: hash, quote: quote as unknown as Prisma.InputJsonValue,
  } });
}

export type CaptureEvidenceReader = {
  // Must be selected by SERVER configuration, never request body or provider URL.
  scope: ProviderReadScope;
  read: (expectation: CaptureExpectation) => Promise<unknown>;
};

/** Provider read is OUTSIDE the DB transaction. No charge/refund/transfer is made. */
export async function verifyAndBookEconomicCapture(db: Database, operationId: string, reader: CaptureEvidenceReader) {
  const operation = await db.economicOperation.findUniqueOrThrow({
    where: { id: operationId }, include: { context: true },
  });
  const payment = await db.payment.findUniqueOrThrow({ where: { orderId: operation.context.orderId } });
  if (operation.kind !== 'CAPTURE' || !['DISPATCHED', 'NEEDS_RECONCILIATION', 'SUCCEEDED'].includes(operation.state)) {
    throw new Error('Capture operation is not dispatched');
  }
  const providerPaymentId = operation.provider === 'STRIPE' ? payment.stripePaymentIntentId : payment.paypalOrderId;
  if (!providerPaymentId || payment.method !== operation.provider || payment.giftCardCode
    || payment.currency.toUpperCase() !== operation.currency) throw new Error('Payment binding mismatch');
  const expected: CaptureExpectation = {
    operationId, orderId: operation.context.orderId, quoteHash: operation.context.quoteHash,
    provider: operation.provider, providerAccount: operation.providerAccount, provenance: operation.provenance,
    providerPaymentId, currency: operation.currency, minorExponent: operation.context.minorExponent,
    amountMinor: operation.amountMinor.toString(),
  };
  // Do not even read from an incorrectly configured account/mode.
  if (reader.scope.providerAccount !== expected.providerAccount || reader.scope.provenance !== expected.provenance) {
    throw new Error('Provider reader scope mismatch');
  }
  let evidence: CaptureEvidence;
  try {
    const raw = await reader.read(expected);
    evidence = expected.provider === 'STRIPE'
      ? stripeCaptureEvidence(raw, expected, reader.scope)
      : paypalCaptureEvidence(raw, expected, reader.scope);
  } catch (error) {
    await db.economicOperation.updateMany({ where: { id: operationId, state: 'DISPATCHED' }, data: { state: 'NEEDS_RECONCILIATION' } });
    throw error;
  }
  return db.$transaction(async tx => {
    const current = await tx.economicOperation.findUniqueOrThrow({ where: { id: operationId }, include: { context: true } });
    const context = current.context;
    const quote = context.quote as unknown as EconomicQuote;
    if (current.kind !== 'CAPTURE' || context.policyVersion !== ECONOMIC_POLICY_VERSION || quoteFingerprint(quote) !== context.quoteHash
      || quote.orderId !== context.orderId || quote.currency !== context.currency || quote.minorExponent !== context.minorExponent
      || context.quoteHash !== evidence.quoteHash || context.orderId !== evidence.orderId
      || current.provider !== evidence.provider || current.providerAccount !== evidence.providerAccount
      || current.provenance !== evidence.provenance || current.currency !== evidence.currency
      || current.amountMinor !== exactMinor(evidence.amountMinor)
      || current.amountMinor !== exactMinor(quote.customerTotalMinor)) throw new Error('Capture does not match frozen quote');
    const previous = await tx.economicCapture.findUnique({ where: { contextId: context.id } });
    if (previous) {
      if (previous.operationId !== operationId || previous.evidenceHash !== evidence.evidenceHash
        || current.state !== 'SUCCEEDED') throw new Error('Conflicting capture requires reconciliation');
      return previous;
    }
    const order = await assertOrderMatchesQuote(tx, quote);
    if (!order.payment || order.payment.id !== payment.id || order.payment.status !== 'PENDING'
      || order.payment.method !== current.provider || order.payment.currency.toUpperCase() !== current.currency
      || parseMinorUnits(order.payment.amount.toString(), quote.minorExponent) !== current.amountMinor
      || (current.provider === 'STRIPE' ? order.payment.stripePaymentIntentId : order.payment.paypalOrderId) !== providerPaymentId) {
      throw new Error('Payment changed during capture verification');
    }
    const now = new Date();
    const claimed = await tx.economicOperation.updateMany({
      where: { id: operationId, kind: 'CAPTURE', state: { in: ['DISPATCHED', 'NEEDS_RECONCILIATION'] } },
      data: { state: 'SUCCEEDED', providerReference: evidence.providerReference, completedAt: now },
    });
    if (claimed.count !== 1) throw new Error('Concurrent capture changed; retry the same operation');
    const capture = await tx.economicCapture.create({ data: {
      contextId: context.id, operationId, provider: current.provider, providerAccount: current.providerAccount,
      provenance: current.provenance, providerReference: evidence.providerReference, currency: current.currency,
      amountMinor: current.amountMinor, quoteHash: context.quoteHash, evidenceHash: evidence.evidenceHash, verifiedAt: now,
    } });
    await tx.economicCaptureAllocation.createMany({ data: quote.parts.map(part => ({
      captureId: capture.id, partKey: part.key, kind: part.kind, storeId: part.storeId, storeOrderId: part.storeOrderId,
      lineId: part.lineId, quantity: part.quantity, currency: quote.currency,
      customerMinor: exactMinor(part.customerMinor), platformFundingMinor: exactMinor(part.platformFundingMinor),
      sellerGrossMinor: exactMinor(part.sellerGrossMinor), sellerFeeMinor: exactMinor(part.sellerFeeMinor),
      sellerNetMinor: exactMinor(part.sellerNetMinor), fees: part.fees,
    })) });
    await tx.economicJournalEntry.createMany({ data: captureJournal(quote).map(row => ({ ...row, captureId: capture.id })) });
    await seedCapturedBalanceLots(tx, capture.id, quote, current.provenance, now);
    const paymentUpdated = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: {
      status: 'PAID', paidAt: now,
      ...(current.provider === 'STRIPE' ? { stripeChargeId: evidence.providerReference } : { paypalCaptureId: evidence.providerReference }),
    } });
    if (paymentUpdated.count !== 1) throw new Error('Concurrent payment transition; capture rolled back');
    await appendEconomicEvent(tx, { contextId: context.id, operationId, eventKey: `capture:${capture.id}`, eventType: 'capture.verified.v1' });
    // Capture ≠ stock consumption/fulfillment. No lifecycle status, legacy ledger,
    // affiliate balance, cart clearing, provider I/O or queue publish here.
    return capture;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
