import { EconomicOperation, Payment, PrismaClient } from '@prisma/client';
import { buildEconomicQuote, quoteFingerprint } from '../finances/economic-quote';
import { createEconomicPayment, EconomicPaymentCreator } from './economic-payment-intent';
import { verifyPaypalCreatedPayment, verifyStripeCreatedPayment } from './economic-payments.service';

function harness(provider: 'STRIPE' | 'PAYPAL' = 'STRIPE') {
  const quote = buildEconomicQuote({ orderId: 'order', currency: 'USD', minorExponent: 2,
    stores: [{ storeId: 'store', storeOrderId: 'shop', lines: [{ id: 'line', productId: 'product', variantId: null,
      quantity: 1, unitPriceMinor: '1000', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
    customerShippingMinor: '0', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] }],
    affiliate: null, tax: { amountMinor: '0', ruleReference: 'synthetic' } });
  const context = { id: 'ctx', orderId: 'order', quote, quoteHash: quoteFingerprint(quote), policyVersion: quote.version,
    currency: 'USD', minorExponent: 2, provenance: 'TEST' };
  const operations: EconomicOperation[] = [];
  const order = { status: 'PENDING_PAYMENT', adminArchivedAt: null, payment: null as Payment | null };
  let inside = false;
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    order: { findUniqueOrThrow: jest.fn(async () => order) },
    economicOrderContext: { findUniqueOrThrow: jest.fn(async () => context) },
    economicOperation: {
      findMany: jest.fn(async () => operations),
      createMany: jest.fn(async ({ data }) => {
        const value = data[0];
        if (!operations.some(row => row.kind === value.kind)) operations.push({ ...value, id: value.kind === 'CAPTURE' ? 'capture-op' : 'create-op',
          providerReference: null, dispatchToken: null } as EconomicOperation);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(async ({ where }) => operations.find(row => row.kind === where.provider_providerAccount_provenance_kind_idempotencyKey.kind)),
      updateMany: jest.fn(async ({ where, data }) => {
        const op = operations.find(row => row.id === where.id);
        if (!op || (typeof where.state === 'string' ? op.state !== where.state : !where.state.in.includes(op.state))
          || (where.dispatchToken && where.dispatchToken !== op.dispatchToken)) return { count: 0 };
        Object.assign(op, data); return { count: 1 };
      }),
    },
    payment: {
      create: jest.fn(async ({ data }) => { order.payment = { ...data, id: 'payment', stripePaymentIntentId: null, paypalOrderId: null } as Payment; return order.payment; }),
      updateMany: jest.fn(async ({ data }) => { if (!order.payment) throw new Error('Missing fixture payment'); Object.assign(order.payment, data); return { count: 1 }; }),
    },
  };
  const db = { ...tx, $transaction: jest.fn(async work => {
    const prior = operations.map(row => ({ ...row })), payment = order.payment ? { ...order.payment } : null;
    inside = true;
    try { return await work(tx); } catch (error) { operations.splice(0, operations.length, ...prior); order.payment = payment; throw error; }
    finally { inside = false; }
  }) };
  const creator: EconomicPaymentCreator = { provider, providerAccount: 'acct_platform', provenance: 'TEST',
    create: jest.fn(async binding => {
      expect(inside).toBe(false);
      expect(operations.find(op => op.kind === 'PAYMENT_CREATE')?.state).toBe('DISPATCHED');
      expect(order.payment?.status).toBe('PENDING');
      expect(binding.operationId).toBe('capture-op');
      return { id: provider === 'STRIPE' ? 'pi_fixture' : 'PAYPALORDER', clientSecret: 'synthetic', approvalUrl: '' };
    }),
    read: jest.fn(async id => { expect(inside).toBe(false); return { id, clientSecret: 'synthetic' }; }),
  };
  return { database: db as unknown as PrismaClient, db, tx, creator, context, operations, order };
}

describe('versioned payment creation (modeled transactions, no provider network)', () => {
  it.each(['STRIPE', 'PAYPAL'] as const)('persists %s intents before I/O and retrieves the same payment on replay', async provider => {
    const h = harness(provider);
    const result = await createEconomicPayment(h.database, 'order', h.creator);
    expect(result.id).toBe(provider === 'STRIPE' ? 'pi_fixture' : 'PAYPALORDER');
    expect(h.operations.find(op => op.kind === 'PAYMENT_CREATE')?.state).toBe('SUCCEEDED');
    expect(h.operations.find(op => op.kind === 'CAPTURE')?.state).toBe(provider === 'STRIPE' ? 'DISPATCHED' : 'PREPARED');
    await createEconomicPayment(h.database, 'order', h.creator);
    expect(h.creator.create).toHaveBeenCalledTimes(1);
    expect(h.creator.read).toHaveBeenCalledTimes(1);
  });
  it('quarantines timeout and never blindly re-creates the payment', async () => {
    const h = harness();
    (h.creator.create as jest.Mock).mockRejectedValue(new Error('synthetic timeout'));
    await expect(createEconomicPayment(h.database, 'order', h.creator)).rejects.toThrow('timeout');
    expect(h.operations.find(op => op.kind === 'PAYMENT_CREATE')?.state).toBe('NEEDS_RECONCILIATION');
    await expect(createEconomicPayment(h.database, 'order', h.creator)).rejects.toThrow('awaiting reconciliation');
    expect(h.creator.create).toHaveBeenCalledTimes(1);
    expect(h.order.payment?.stripePaymentIntentId).toBeNull();
  });
  it('rolls binding/completion back together when database commit path fails after provider success', async () => {
    const h = harness();
    h.tx.payment.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(createEconomicPayment(h.database, 'order', h.creator)).rejects.toThrow('binding changed');
    expect(h.order.payment?.stripePaymentIntentId).toBeNull();
    expect(h.operations.find(op => op.kind === 'PAYMENT_CREATE')?.state).toBe('NEEDS_RECONCILIATION');
    expect(h.operations.find(op => op.kind === 'CAPTURE')?.state).toBe('PREPARED');
  });
  it('refuses mode changes, unsupported order lifecycle and rebinding to another provider', async () => {
    const h = harness();
    await expect(createEconomicPayment(h.database, 'order', { ...h.creator, provenance: 'LIVE' })).rejects.toThrow('mode mismatch');
    h.order.status = 'CONFIRMED';
    await expect(createEconomicPayment(h.database, 'order', h.creator)).rejects.toThrow('not awaiting');
    h.order.status = 'PENDING_PAYMENT';
    await createEconomicPayment(h.database, 'order', h.creator);
    await expect(createEconomicPayment(h.database, 'order', { ...h.creator, provider: 'PAYPAL' })).rejects.toThrow('already selected');
    expect(h.creator.create).toHaveBeenCalledTimes(1);
  });
  it('rejects altered immutable quote data before provider dispatch', async () => {
    const h = harness(); h.context.quote.customerTotalMinor = '1001';
    await expect(createEconomicPayment(h.database, 'order', h.creator)).rejects.toThrow();
    expect(h.creator.create).not.toHaveBeenCalled();
  });
});

describe('provider creation response binding', () => {
  const binding = { orderId: 'order', operationId: 'capture-op', createOperationId: 'create-op', quoteHash: 'a'.repeat(64),
    provider: 'STRIPE' as const, providerAccount: 'MERCHANT', provenance: 'TEST' as const, currency: 'USD', minorExponent: 2, amountMinor: '1000' };
  const stripe = () => ({ id: 'pi_fixture', amount: 1000, currency: 'usd', livemode: false, status: 'requires_payment_method', client_secret: 'synthetic',
    metadata: { orderId: binding.orderId, economicOperationId: binding.operationId, quoteHash: binding.quoteHash } });
  it('accepts a fully matched Stripe object and rejects changed mode/amount/metadata', () => {
    expect(verifyStripeCreatedPayment(stripe(), binding).id).toBe('pi_fixture');
    for (const change of [{ amount: 1001 }, { livemode: true }, { metadata: {} }, { currency: 'eur' }, { status: 'canceled' }]) {
      expect(() => verifyStripeCreatedPayment({ ...stripe(), ...change }, binding)).toThrow('reconciliation');
    }
  });
  const paypal = () => ({ id: 'PAYPALORDER', intent: 'CAPTURE', status: 'CREATED', purchase_units: [{ reference_id: binding.orderId,
    custom_id: binding.operationId, invoice_id: binding.quoteHash, payee: { merchant_id: binding.providerAccount }, amount: { currency_code: 'USD', value: '10.00' } }],
  links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=synthetic' }] });
  it('binds PayPal to merchant/quote and rejects foreign approval URLs', () => {
    const expected = { ...binding, provider: 'PAYPAL' as const };
    expect(verifyPaypalCreatedPayment(paypal(), expected).id).toBe('PAYPALORDER');
    const wrong = paypal(); wrong.purchase_units[0].payee.merchant_id = 'FOREIGN';
    expect(() => verifyPaypalCreatedPayment(wrong, expected)).toThrow('reconciliation');
    const external = paypal(); external.links[0].href = 'https://www.sandbox.paypal.com.evil.test/checkout';
    expect(() => verifyPaypalCreatedPayment(external, expected)).toThrow('Untrusted');
  });
});
