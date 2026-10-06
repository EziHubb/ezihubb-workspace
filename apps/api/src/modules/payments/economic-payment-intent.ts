import { BadRequestException, ConflictException } from '@nestjs/common';
import { EconomicProvider, EconomicProvenance, PrismaClient } from '@prisma/client';
import { economicTransaction, minorDecimal } from '../finances/economic-balance';
import { EconomicQuote, exactMinor, quoteFingerprint } from '../finances/economic-quote';
import { claimEconomicOperation, markEconomicOperationAmbiguous, prepareEconomicOperation } from '../finances/economic-durability';

type Database = Pick<PrismaClient, '$transaction' | 'economicOperation' | 'economicOutbox'>;
export type PaymentCreationBinding = {
  orderId: string; operationId: string; createOperationId: string; quoteHash: string;
  provider: EconomicProvider; providerAccount: string; provenance: EconomicProvenance;
  amountMinor: string; currency: string; minorExponent: number;
};
export type CreatedEconomicPayment = { id: string; clientSecret?: string; approvalUrl?: string };
export type EconomicPaymentCreator = {
  provider: EconomicProvider; providerAccount: string; provenance: EconomicProvenance;
  // Both functions must verify amount, metadata, account and mode before returning.
  create: (binding: PaymentCreationBinding) => Promise<CreatedEconomicPayment>;
  read: (id: string, binding: PaymentCreationBinding) => Promise<CreatedEconomicPayment>;
};

/** One selected provider per quote; changing provider requires explicit void evidence.
 * DB-only retries, stable operation keys, no provider I/O inside a transaction.
 * An ambiguous creation is quarantined, never blindly created a second time.
 */
export async function createEconomicPayment(db: Database, orderId: string, creator: EconomicPaymentCreator) {
  const prepared = await economicTransaction(db, async tx => {
    const context = await tx.economicOrderContext.findUniqueOrThrow({ where: { orderId } });
    await tx.$queryRaw`SELECT "id" FROM "EconomicOrderContext" WHERE "id" = ${context.id} FOR UPDATE`;
    const quote = context.quote as unknown as EconomicQuote;
    if (context.provenance !== creator.provenance || quoteFingerprint(quote) !== context.quoteHash
      || quote.orderId !== orderId || quote.currency !== context.currency || quote.minorExponent !== context.minorExponent) {
      throw new BadRequestException('Payment quote/account mode mismatch');
    }
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true } });
    if (order.status !== 'PENDING_PAYMENT' || order.adminArchivedAt || (order.payment && order.payment.status !== 'PENDING')) {
      throw new BadRequestException('Order is not awaiting payment');
    }
    const operations = await tx.economicOperation.findMany({ where: { contextId: context.id, kind: { in: ['PAYMENT_CREATE', 'CAPTURE'] } } });
    if (operations.some(op => op.provider !== creator.provider || op.providerAccount !== creator.providerAccount)) {
      throw new ConflictException('Payment provider is already selected; reconcile or void the original payment first');
    }
    if (order.payment && (order.payment.method !== creator.provider || order.payment.giftCardCode
      || (!operations.length && (order.payment.stripePaymentIntentId || order.payment.paypalOrderId)))) {
      throw new ConflictException('Existing payment cannot be rebound to a new operation');
    }
    const amountMinor = exactMinor(quote.customerTotalMinor);
    const common = { contextId: context.id, provenance: context.provenance, currency: context.currency,
      provider: creator.provider, providerAccount: creator.providerAccount, amountMinor, requestHash: context.quoteHash };
    const create = await prepareEconomicOperation(tx, { ...common, kind: 'PAYMENT_CREATE', idempotencyKey: `create:${context.id}` });
    const capture = await prepareEconomicOperation(tx, { ...common, kind: 'CAPTURE', idempotencyKey: `capture:${context.id}` });
    if (!order.payment) await tx.payment.create({ data: { orderId, method: creator.provider, status: 'PENDING',
      currency: context.currency, amount: minorDecimal(amountMinor, context.minorExponent) } });
    const binding: PaymentCreationBinding = { orderId, operationId: capture.id, createOperationId: create.id,
      provider: creator.provider, providerAccount: creator.providerAccount, provenance: context.provenance,
      amountMinor: amountMinor.toString(), currency: context.currency, minorExponent: context.minorExponent, quoteHash: context.quoteHash };
    const paymentId = creator.provider === 'STRIPE' ? order.payment?.stripePaymentIntentId : order.payment?.paypalOrderId;
    return { create, binding, paymentId };
  });
  if (prepared.paymentId) {
    if (prepared.create.state !== 'SUCCEEDED' || prepared.create.providerReference !== prepared.paymentId) throw new ConflictException('Payment binding requires reconciliation');
    return creator.read(prepared.paymentId, prepared.binding);
  }
  const token = await claimEconomicOperation(db, prepared.create.id);
  if (!token) throw new ConflictException('Payment creation is in progress or awaiting reconciliation; no new charge was created');
  try {
    const result = await creator.create(prepared.binding);
    if (!result.id || result.id.length > 150) throw new Error('Provider payment identity missing');
    await economicTransaction(db, async tx => {
      await tx.$queryRaw`SELECT "id" FROM "EconomicOrderContext" WHERE "id" = ${prepared.create.contextId} FOR UPDATE`;
      const complete = await tx.economicOperation.updateMany({ where: { id: prepared.create.id, dispatchToken: token,
        state: { in: ['DISPATCHED', 'NEEDS_RECONCILIATION'] } }, data: { state: 'SUCCEEDED', providerReference: result.id, completedAt: new Date() } });
      if (complete.count !== 1) throw new ConflictException('Payment creation state changed');
      const saved = await tx.payment.updateMany({ where: { orderId, status: 'PENDING', method: creator.provider,
        stripePaymentIntentId: null, paypalOrderId: null }, data: creator.provider === 'STRIPE'
        ? { stripePaymentIntentId: result.id } : { paypalOrderId: result.id } });
      if (saved.count !== 1) throw new ConflictException('Payment binding changed');
      // Stripe client confirmation can charge immediately; persist dispatch BEFORE releasing the secret.
      // PayPal is explicitly captured by the server after buyer approval instead.
      if (creator.provider === 'STRIPE') {
        const claimed = await claimEconomicOperation(tx, prepared.binding.operationId);
        if (!claimed) throw new ConflictException('Capture operation already dispatched');
      }
    });
    return result;
  } catch (error) {
    await markEconomicOperationAmbiguous(db, prepared.create.id, token);
    throw error;
  }
}
