import { Prisma, PrismaClient } from '@prisma/client';
import { persistEconomicQuote, verifyAndBookEconomicCapture } from './economic-capture';
import { buildEconomicQuote, canonicalEconomicJson, QuoteInput, quoteFingerprint } from './economic-quote';

const input: QuoteInput = {
  orderId: 'order1', currency: 'USD', minorExponent: 2,
  stores: [{ storeId: 'store1', storeOrderId: 'storeOrder1', lines: [
    { id: 'line1', productId: 'product1', variantId: null, quantity: 2,
      unitPriceMinor: '1000', sellerDiscountMinor: '0', platformDiscountMinor: '100' },
  ], customerShippingMinor: '0', expectedShippingSubsidyMinor: '500', giftWrapMinor: '0',
  fees: [{ code: 'TRANSACTION_FEE', amountMinor: '100', ruleReference: 'settings-v1' }] }],
  tax: { amountMinor: '0', ruleReference: 'synthetic-rule' }, affiliate: null,
};

function harness() {
  const quote = buildEconomicQuote(input);
  const context = { id: 'context1', orderId: 'order1', provenance: 'TEST', currency: 'USD', minorExponent: 2,
    policyVersion: quote.version, quoteHash: quoteFingerprint(quote), quote: JSON.parse(canonicalEconomicJson(quote)) };
  const operation = { id: 'operation1', contextId: context.id, context, kind: 'CAPTURE', state: 'DISPATCHED',
    provider: 'STRIPE', providerAccount: 'acct_test', provenance: 'TEST', currency: 'USD', amountMinor: 1900n,
    providerReference: null as string | null };
  const payment = { id: 'payment1', orderId: 'order1', method: 'STRIPE', currency: 'usd',
    stripePaymentIntentId: 'pi_test', paypalOrderId: null, giftCardCode: null, status: 'PENDING', amount: new Prisma.Decimal('19.00') };
  const order = { id: 'order1', status: 'PENDING_PAYMENT', total: new Prisma.Decimal('19.00'), payment,
    items: [{ id: 'line1', storeId: 'store1', storeOrderId: 'storeOrder1', productId: 'product1', variantId: null,
      quantity: 2, unitPrice: new Prisma.Decimal('10.00') }], storeOrders: [{ id: 'storeOrder1', storeId: 'store1' }] };
  const response = { id: 'pi_test', status: 'succeeded', livemode: false, amount: 1900, amount_received: 1900, currency: 'usd',
    metadata: { orderId: 'order1', economicOperationId: operation.id, quoteHash: context.quoteHash },
    latest_charge: { id: 'ch_test', payment_intent: 'pi_test', livemode: false, status: 'succeeded', paid: true,
      captured: true, amount_captured: 1900, amount_refunded: 0, refunded: false, disputed: false, currency: 'usd' } };
  let savedCapture: Record<string, unknown> | null = null;
  const tx = {
    economicOperation: { findUniqueOrThrow: jest.fn(async () => operation), updateMany: jest.fn(async ({ where, data }) => {
      const eligible = typeof where.state === 'string' ? operation.state === where.state : where.state.in.includes(operation.state);
      if (!eligible) return { count: 0 };
      Object.assign(operation, data); return { count: 1 };
    }) },
    payment: { findUniqueOrThrow: jest.fn(async () => payment), updateMany: jest.fn(async ({ data }) => {
      Object.assign(payment, data); return { count: 1 };
    }) },
    order: { findUniqueOrThrow: jest.fn(async () => order) },
    sellerLedgerEntry: { count: jest.fn().mockResolvedValue(0) },
    economicOrderContext: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => ({ id: context.id, ...data })) },
    economicCapture: { findUnique: jest.fn(async () => savedCapture), create: jest.fn(async ({ data }) => {
      savedCapture = { id: 'capture1', ...data }; return savedCapture;
    }) },
    economicCaptureAllocation: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    economicBalanceAccount: { createMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'balance1', minorExponent: 2 }) },
    economicBalanceLot: { create: jest.fn().mockResolvedValue({ id: 'lot1' }) },
    economicJournalEntry: { createMany: jest.fn().mockResolvedValue({ count: 4 }) },
    economicOutbox: { createMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn(async () => ({
      id: 'event1', contextId: context.id, eventType: 'capture.verified.v1', payload: { operationId: operation.id },
    })) },
  };
  const transaction = tx as unknown as Prisma.TransactionClient;
  const db = { ...tx, $transaction: jest.fn(async (fn: (client: Prisma.TransactionClient) => Promise<unknown>, _options?: unknown) => {
    const beforeOperation = { ...operation };
    const beforePayment = { ...payment };
    const beforeCapture = savedCapture;
    try { return await fn(transaction); } catch (error) {
      Object.assign(operation, beforeOperation); Object.assign(payment, beforePayment); savedCapture = beforeCapture;
      throw error;
    }
  }) };
  const reader = { scope: { providerAccount: 'acct_test', provenance: 'TEST' as const }, read: jest.fn().mockResolvedValue(response) };
  return { tx, db, database: db as unknown as PrismaClient, transaction, context, operation, payment, order, response, reader };
}

describe('quote/capture booking transaction contracts (mocked DB/provider)', () => {
  it('persists a canonical quote only for a new unpaid order without legacy credits', async () => {
    const h = harness();
    expect(await persistEconomicQuote(h.transaction, input, 'TEST')).toMatchObject({ quoteHash: h.context.quoteHash });
    expect(h.tx.economicOrderContext.create).toHaveBeenCalledWith({ data: expect.objectContaining({ provenance: 'TEST', orderId: 'order1' }) });
    h.tx.sellerLedgerEntry.count.mockResolvedValue(1);
    await expect(persistEconomicQuote(h.transaction, input, 'TEST')).rejects.toThrow('Legacy');
  });
  it('rejects cross-shop or changed lines and unsupported tender allocation before freezing', async () => {
    const h = harness();
    h.order.items[0].storeId = 'foreign';
    await expect(persistEconomicQuote(h.transaction, input, 'TEST')).rejects.toThrow('foreign or changed');
    h.order.items[0].storeId = 'store1'; h.payment.method = 'MIXED';
    await expect(persistEconomicQuote(h.transaction, input, 'TEST')).rejects.toThrow('Split/gift-card');
    expect(h.tx.economicOrderContext.create).not.toHaveBeenCalled();
  });
  it('freezes existing snapshot identity rather than overwriting it on retry', async () => {
    const h = harness();
    h.tx.economicOrderContext.findUnique.mockResolvedValue(h.context);
    expect(await persistEconomicQuote(h.transaction, input, 'TEST')).toBe(h.context);
    await expect(persistEconomicQuote(h.transaction, input, 'LIVE')).rejects.toThrow('already frozen');
    expect(h.tx.economicOrderContext.create).not.toHaveBeenCalled();
  });
  it('reads provider first, then books capture, allocations, journal, payment and outbox in one transaction', async () => {
    const h = harness();
    await verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader);
    expect(h.reader.read.mock.invocationCallOrder[0]).toBeLessThan(h.db.$transaction.mock.invocationCallOrder[0]);
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(h.operation.state).toBe('SUCCEEDED'); expect(h.payment.status).toBe('PAID');
    expect(h.tx.economicCapture.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountMinor: 1900n, providerReference: 'ch_test' }) });
    expect(h.tx.economicCaptureAllocation.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
      storeId: 'store1', customerMinor: 1900n, platformFundingMinor: 100n, sellerNetMinor: 1900n,
    })] });
    const rows = h.tx.economicJournalEntry.createMany.mock.calls[0][0].data as Array<{ amountMinor: bigint }>;
    expect(rows.reduce((sum, row) => sum + row.amountMinor, 0n)).toBe(0n);
    expect(h.tx.economicOutbox.createMany).toHaveBeenCalledTimes(1);
    expect(h.order.status).toBe('PENDING_PAYMENT'); // capture alone cannot authorize fulfillment
  });
  it('replay re-verifies evidence but never rebooks economic effects', async () => {
    const h = harness();
    const first = await verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader);
    const second = await verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader);
    expect(second).toEqual(first);
    expect(h.tx.economicCapture.create).toHaveBeenCalledTimes(1);
    expect(h.tx.economicJournalEntry.createMany).toHaveBeenCalledTimes(1);
    expect(h.tx.economicOutbox.createMany).toHaveBeenCalledTimes(1);
  });
  it('routes mismatched provider evidence to reconciliation without creating money', async () => {
    const h = harness(); h.response.amount_received = 1800;
    await expect(verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader)).rejects.toThrow('reconciliation');
    expect(h.operation.state).toBe('NEEDS_RECONCILIATION');
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.tx.economicJournalEntry.createMany).not.toHaveBeenCalled();
  });
  it('rejects configured account mismatch before accessing any provider', async () => {
    const h = harness(); h.reader.scope.providerAccount = 'acct_foreign';
    await expect(verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader)).rejects.toThrow('scope mismatch');
    expect(h.reader.read).not.toHaveBeenCalled();
  });
  it('rolls capture and Payment back if the outbox write fails, then retries the same read/operation', async () => {
    const h = harness(); h.tx.economicOutbox.createMany.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader)).rejects.toThrow('database unavailable');
    expect(h.operation.state).toBe('DISPATCHED'); expect(h.payment.status).toBe('PENDING');
    await expect(verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader)).resolves.toMatchObject({ id: 'capture1' });
    expect(h.operation.state).toBe('SUCCEEDED');
  });
  it('rejects stale order totals before booking and changed Payment bindings inside the transaction', async () => {
    const h = harness(); h.order.total = new Prisma.Decimal('20.00');
    await expect(verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader)).rejects.toThrow('no longer matches');
    expect(h.tx.economicCapture.create).not.toHaveBeenCalled();
    h.order.total = new Prisma.Decimal('19.00');
    h.reader.read.mockImplementation(async () => { h.payment.stripePaymentIntentId = 'pi_other'; return h.response; });
    await expect(verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader)).rejects.toThrow('Payment changed');
  });
  it.each(['method', 'currency'] as const)('rechecks payment %s after the provider read, before any money write', async field => {
    const h = harness();
    h.reader.read.mockImplementation(async () => {
      h.payment[field] = field === 'method' ? 'PAYPAL' : 'eur';
      return h.response;
    });
    await expect(verifyAndBookEconomicCapture(h.database, h.operation.id, h.reader)).rejects.toThrow('Payment changed');
    expect(h.tx.economicCapture.create).not.toHaveBeenCalled();
    expect(h.operation.state).toBe('DISPATCHED');
  });
});
