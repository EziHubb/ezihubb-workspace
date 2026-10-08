import { PrismaClient } from '@prisma/client';
import { buildEconomicQuote, quoteFingerprint } from './economic-quote';
import { prepareQuantityRefund } from './economic-refund';

function fixture(giftWrapMinor = '0', customerShippingMinor = '0') {
  const quote = buildEconomicQuote({ orderId: 'order', currency: 'USD', minorExponent: 2,
    stores: [{ storeId: 'shop', storeOrderId: 'store-order', lines: [{ id: 'line', productId: 'product', variantId: null,
      quantity: 2, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
      customerShippingMinor, expectedShippingSubsidyMinor: '500', giftWrapMinor, fees: [] }],
    tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null });
  const context = { id: 'context', policyVersion: quote.version, provenance: 'TEST', currency: 'USD', quote };
  const capture = { id: 'capture', contextId: context.id, context, quoteHash: quoteFingerprint(quote),
    provider: 'STRIPE', providerAccount: 'acct_fixture', provenance: 'TEST', currency: 'USD' };
  const operations: Array<Record<string, unknown>> = [];
  const requests: Array<Record<string, unknown> & { operation: Record<string, unknown> }> = [];
  const lots = [{ accountId: 'account', reservedMinor: 0n }];
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    economicCapture: { findUniqueOrThrow: jest.fn().mockResolvedValue(capture) },
    economicOrderContext: { findUniqueOrThrow: jest.fn().mockResolvedValue(context) },
    economicBalanceLot: { findMany: jest.fn().mockResolvedValue(lots) },
    economicOperation: {
      findMany: jest.fn(async () => operations.filter(op => op['state'] !== 'FAILED')),
      createMany: jest.fn(async ({ data }) => { operations.push({ id: `op${operations.length}`, ...data[0] }); return { count: 1 }; }),
      findUniqueOrThrow: jest.fn(async ({ where }) => operations.find(op => op['idempotencyKey'] === where.provider_providerAccount_provenance_kind_idempotencyKey.idempotencyKey)),
    },
    economicRefundRequest: {
      findMany: jest.fn().mockResolvedValue(requests),
      create: jest.fn(async ({ data }) => {
        const request = { ...data, id: `refund${requests.length}`, operation: operations.find(op => op['id'] === data.operationId) as Record<string, unknown> };
        requests.push(request); return request;
      }),
    },
  };
  const db = { $transaction: jest.fn(async work => work(tx)) } as unknown as PrismaClient;
  return { db, tx, operations, requests, lots };
}
const input = { captureId: 'capture', actorId: 'operator', reason: 'Synthetic return', idempotencyKey: 'request-1',
  selection: [{ partKey: 'item:line', quantity: 1 }] };

describe('refund intent preparation (modeled DB, no provider dispatch)', () => {
  it('serializes shipping exceptions, replays identity, caps settled money and keeps merchandise quantities independent', async () => {
    const h = fixture('0', '500'), first = { ...input, selection: [],
      shippingOverride: { partKey: 'shipping:store-order', amountMinor: '200', evidenceReference: 'case-1' } };
    const request = await prepareQuantityRefund(h.db, first);
    expect(request.plan).toMatchObject({ version: 'shipping-override-v1', customerMinor: '200' });
    expect((await prepareQuantityRefund(h.db, first)).id).toBe(request.id);
    await expect(prepareQuantityRefund(h.db, { ...first, shippingOverride: { ...first.shippingOverride, evidenceReference: 'changed' } })).rejects.toThrow('different details');
    await expect(prepareQuantityRefund(h.db, { ...first, idempotencyKey: 'second' })).rejects.toThrow('existing refund');
    h.operations[0]['state'] = 'SUCCEEDED'; h.requests[0]['settlement'] = { id: 'proof' };
    await expect(prepareQuantityRefund(h.db, { ...first, idempotencyKey: 'excess', shippingOverride: { ...first.shippingOverride, amountMinor: '301' } })).rejects.toThrow('remaining customer');
    const merchandise = await prepareQuantityRefund(h.db, { ...input, idempotencyKey: 'item' });
    expect(merchandise.plan).toMatchObject({ parts: [{ previousQuantity: 0, quantity: 1 }] });
    h.operations[1]['state'] = 'SUCCEEDED'; h.requests[1]['settlement'] = { id: 'item-proof' };
    const second = await prepareQuantityRefund(h.db, { ...first, idempotencyKey: 'second', shippingOverride: { ...first.shippingOverride, amountMinor: '300' } });
    expect(second.plan).toMatchObject({ shippingOverrideApproval: { previousCustomerMinor: '200' } });
  });
  it('records separate gift wrap approval with the trusted actor/reason and rejects changing approval on replay', async () => {
    const h = fixture('25'), gift = { ...input, selection: [{ partKey: 'gift-wrap:store-order', quantity: 1 }] };
    await expect(prepareQuantityRefund(h.db, gift)).rejects.toThrow('explicitly approved');
    expect(h.operations).toHaveLength(0);
    const approved = await prepareQuantityRefund(h.db, { ...gift, approveGiftWrap: true });
    expect(approved.plan).toMatchObject({ customerMinor: '25', affiliateMinor: '0', giftWrapApproval: { approvedBy: 'operator', reason: input.reason } });
    expect((await prepareQuantityRefund(h.db, { ...gift, approveGiftWrap: true })).id).toBe(approved.id);
    await expect(prepareQuantityRefund(h.db, gift)).rejects.toThrow('different details');
    expect(h.operations).toHaveLength(1);
  });
  it('persists the original allocation and returns the same request on replay', async () => {
    const h = fixture();
    const first = await prepareQuantityRefund(h.db, input);
    const again = await prepareQuantityRefund(h.db, input);
    expect(again.id).toBe(first.id);
    expect(h.operations).toHaveLength(1);
    expect(h.operations[0]).toMatchObject({ amountMinor: 100n, kind: 'REFUND', state: 'PREPARED' });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ platformRoundingMinor: 0n, plannedJournal: [
      { entryKey: 'customer-refund', account: 'CUSTOMER_FUNDS', amountMinor: '-100' },
      { entryKey: 'item:line:seller-net', account: 'SELLER_PAYABLE', amountMinor: '100', beneficiaryId: 'shop' },
    ] });
    expect(h.tx.$queryRaw).toHaveBeenCalled();
  });
  it('rejects changed payload or actor under the same request identity', async () => {
    const h = fixture(); await prepareQuantityRefund(h.db, input);
    await expect(prepareQuantityRefund(h.db, { ...input, reason: 'Different' })).rejects.toThrow('different details');
    await expect(prepareQuantityRefund(h.db, { ...input, actorId: 'foreign' })).rejects.toThrow('different details');
    expect(h.requests).toHaveLength(1);
  });
  it('blocks another request while the original outcome is unknown', async () => {
    const h = fixture(); await prepareQuantityRefund(h.db, input);
    h.operations[0]['state'] = 'NEEDS_RECONCILIATION';
    await expect(prepareQuantityRefund(h.db, { ...input, idempotencyKey: 'new-key' })).rejects.toThrow('existing refund');
    expect(h.requests).toHaveLength(1);
  });
  it('uses successful original quantities and rejects cumulative excess', async () => {
    const h = fixture(); await prepareQuantityRefund(h.db, input);
    h.operations[0]['state'] = 'SUCCEEDED';
    h.requests[0]['settlement'] = { id: 'synthetic-proof-1' };
    const second = await prepareQuantityRefund(h.db, { ...input, idempotencyKey: 'second' });
    expect(second.plan).toMatchObject({ parts: [{ previousQuantity: 1, quantity: 1 }] });
    h.operations[1]['state'] = 'SUCCEEDED';
    h.requests[1]['settlement'] = { id: 'synthetic-proof-2' };
    await expect(prepareQuantityRefund(h.db, { ...input, idempotencyKey: 'third' })).rejects.toThrow('exceeds');
  });
  it('does not treat SUCCEEDED without immutable settlement as refund history', async () => {
    const h = fixture(); await prepareQuantityRefund(h.db, input);
    h.operations[0]['state'] = 'SUCCEEDED';
    await expect(prepareQuantityRefund(h.db, { ...input, idempotencyKey: 'second' })).rejects.toThrow('existing refund');
  });
  it('does not prepare a refund against a reserved payout', async () => {
    const h = fixture(); h.lots[0].reservedMinor = 1n;
    await expect(prepareQuantityRefund(h.db, input)).rejects.toThrow('reserved payouts');
    expect(h.tx.economicOperation.createMany).not.toHaveBeenCalled();
  });
});
