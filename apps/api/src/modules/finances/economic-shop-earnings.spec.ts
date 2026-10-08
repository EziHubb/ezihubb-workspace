import { PrismaClient } from '@prisma/client';
import { readEconomicShopEarnings } from './economic-shop-earnings';
import { buildEconomicQuote, exactMinor, quoteFingerprint } from './economic-quote';
import { EconomicRefundPlan, planQuantityRefund } from './economic-refund-plan';
import { plannedRefundJournal } from './economic-refund-journal';

function fixture(provenance: 'LIVE' | 'TEST' = 'LIVE', unitPriceMinor = '100') {
  const quote = buildEconomicQuote({ orderId: 'order', currency: 'USD', minorExponent: 2,
    stores: ['A', 'B'].map(id => ({ storeId: id, storeOrderId: `shop-${id}`,
      lines: [{ id: `line-${id}`, productId: `product-${id}`, variantId: null, quantity: 2,
        unitPriceMinor, sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
      customerShippingMinor: '0', expectedShippingSubsidyMinor: '500', giftWrapMinor: '0',
      fees: [{ code: 'TRANSACTION_FEE', amountMinor: '20', ruleReference: 'original-policy' }] })),
    tax: { amountMinor: '0', ruleReference: 'original-tax' }, affiliate: null });
  const context = { id: 'context', orderId: 'order', provenance, currency: 'USD', minorExponent: 2, quote, quoteHash: quoteFingerprint(quote) };
  const operation = { state: 'SUCCEEDED', kind: 'CAPTURE', contextId: context.id, providerReference: 'original-capture',
    provenance, currency: 'USD', provider: 'STRIPE', providerAccount: 'account', amountMinor: exactMinor(quote.customerTotalMinor) };
  const capture = { id: 'capture', quoteHash: context.quoteHash, evidenceHash: 'synthetic-proof', providerReference: operation.providerReference,
    provenance, currency: 'USD', provider: 'STRIPE', providerAccount: 'account', amountMinor: operation.amountMinor, operation,
    allocations: quote.parts.filter(part => part.storeId === 'A').map(part => ({ partKey: part.key, kind: part.kind,
      lineId: part.lineId, quantity: part.quantity, currency: 'USD', fees: part.fees,
      customerMinor: exactMinor(part.customerMinor), platformFundingMinor: exactMinor(part.platformFundingMinor),
      sellerGrossMinor: exactMinor(part.sellerGrossMinor), sellerFeeMinor: exactMinor(part.sellerFeeMinor), sellerNetMinor: exactMinor(part.sellerNetMinor) })),
    refundRequests: [] as ReturnType<typeof refund>[] };
  const lots = quote.parts.filter(part => part.storeId === 'A' && exactMinor(part.sellerNetMinor) > 0n).map(part => ({
    sourceKey: part.key, amountMinor: exactMinor(part.sellerNetMinor), reversedMinor: 0n, paidMinor: 0n, reservedMinor: 0n, debtRecoveredMinor: 0n }));
  function refund(plan: EconomicRefundPlan, settled = true) {
    const journal = plannedRefundJournal(plan, quote);
    return { plan, plannedJournal: journal, operation: { state: settled ? 'SUCCEEDED' : 'NEEDS_RECONCILIATION',
      kind: 'REFUND', providerReference: 'original-refund' }, settlement: settled ? {
      evidenceHash: 'synthetic-refund-proof', providerReference: 'original-refund', amountMinor: exactMinor(plan.customerMinor),
      journalEntries: journal.map(row => ({ ...row, amountMinor: BigInt(row.amountMinor) })) } : null };
  }
  const shop = { orderId: 'order', order: { economicContext: context } };
  const tx = { storeOrder: { findFirst: jest.fn(async () => shop) },
    economicCapture: { findUnique: jest.fn(async () => capture) }, economicBalanceLot: { findMany: jest.fn(async () => lots) } };
  const $transaction = jest.fn(async work => work(tx));
  return { db: { $transaction } as unknown as PrismaClient, tx, context, quote, capture, lots, refund, $transaction };
}

describe('shop earnings use original scoped capture/refund evidence, never receipt totals', () => {
  it.each(['LIVE', 'TEST'] as const)('reads only the authorized shop in one %s snapshot', async provenance => {
    const h = fixture(provenance), result = await readEconomicShopEarnings(h.db, 'A', 'shop-A');
    expect(result).toMatchObject({ version: 'economic-v1', provenance, state: 'CAPTURE_VERIFIED', legacyIncluded: false,
      profitMinor: null, actualShippingCostMinor: null, amounts: { customerCapturedMinor: '200', sellerAllocatedMinor: '180',
        netSellerAllocationMinor: '180', sellerFeeMinor: '20', platformFundingMinor: '0' } });
    expect(JSON.stringify(result)).not.toContain('shop-B');
    expect(JSON.stringify(result)).not.toContain('expectedShippingSubsidyMinor');
    expect(h.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(h.tx.storeOrder.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'shop-A', storeId: 'A' } }));
    expect(h.tx.economicBalanceLot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      captureId: 'capture', sourceKey: { in: h.quote.parts.filter(part => part.storeId === 'A').map(part => part.key) },
      account: { kind: 'SELLER', beneficiaryId: 'A', currency: 'USD', provenance } } }));
  });
  it('keeps a legacy context separate and never assigns it LIVE provenance', async () => {
    const h = fixture(); h.tx.storeOrder.findFirst.mockResolvedValueOnce({ orderId: 'order', order: { economicContext: null } } as never);
    expect(await readEconomicShopEarnings(h.db, 'A', 'shop-A')).toBeNull();
    expect(h.tx.economicCapture.findUnique).not.toHaveBeenCalled();
  });
  it('rejects a foreign or missing shop before reading financial evidence', async () => {
    const h = fixture(); h.tx.storeOrder.findFirst.mockResolvedValueOnce(null as never);
    await expect(readEconomicShopEarnings(h.db, 'foreign', 'shop-A')).rejects.toThrow('Order not found');
    expect(h.tx.economicCapture.findUnique).not.toHaveBeenCalled();
  });
  it('does not report a quote or legacy paid flag as verified capture', async () => {
    const h = fixture(); h.tx.economicCapture.findUnique.mockResolvedValueOnce(null as never);
    expect(await readEconomicShopEarnings(h.db, 'A', 'shop-A')).toMatchObject({ state: 'AWAITING_CAPTURE', captureId: null, amounts: null });
    expect(h.tx.economicBalanceLot.findMany).not.toHaveBeenCalled();
  });
  it('keeps exact amounts beyond floating-point precision', async () => {
    const h = fixture('LIVE', '9007199254740993');
    expect(await readEconomicShopEarnings(h.db, 'A', 'shop-A')).toMatchObject({ amounts: {
      customerCapturedMinor: '18014398509481986', sellerAllocatedMinor: '18014398509481966' } });
  });
  it('subtracts only evidenced settled parts for this shop and retains original fee rules', async () => {
    const h = fixture(), plan = planQuantityRefund(h.quote, [{ partKey: 'item:line-A', quantity: 1 }, { partKey: 'item:line-B', quantity: 2 }]);
    h.capture.refundRequests.push(h.refund(plan)); h.lots[0].reversedMinor = 90n;
    expect(await readEconomicShopEarnings(h.db, 'A', 'shop-A')).toMatchObject({ amounts: { customerRefundedMinor: '100',
      netCustomerCollectedMinor: '100', sellerReversedMinor: '90', netSellerAllocationMinor: '90', reversedFeeMinor: '10' },
      feeLines: [{ code: 'TRANSACTION_FEE', ruleReference: 'original-policy', capturedMinor: '20', reversedMinor: '10', netMinor: '10' }] });
  });
  it('holds unknown/prepared requests as pending, without deducting them or another shop request', async () => {
    const h = fixture();
    h.capture.refundRequests.push(h.refund(planQuantityRefund(h.quote, [{ partKey: 'item:line-A', quantity: 1 }]), false),
      h.refund(planQuantityRefund(h.quote, [{ partKey: 'item:line-B', quantity: 1 }]), false));
    expect(await readEconomicShopEarnings(h.db, 'A', 'shop-A')).toMatchObject({ pendingRefundCount: 1,
      amounts: { customerRefundedMinor: '0', netSellerAllocationMinor: '180' } });
  });
  it('does not recompute using changed settings or silently accept altered quote/allocations', async () => {
    const h = fixture(); h.capture.allocations[0].sellerNetMinor += 1n;
    await expect(readEconomicShopEarnings(h.db, 'A', 'shop-A')).rejects.toThrow('allocation mismatch');
    const other = fixture(); other.context.quoteHash = 'changed';
    await expect(readEconomicShopEarnings(other.db, 'A', 'shop-A')).rejects.toThrow('quote requires reconciliation');
  });
  it.each(['mode', 'state', 'evidence'] as const)('fails closed for broken capture %s', async change => {
    const h = fixture();
    if (change === 'mode') h.capture.provenance = 'TEST';
    if (change === 'state') h.capture.operation.state = 'NEEDS_RECONCILIATION';
    if (change === 'evidence') h.capture.evidenceHash = '';
    await expect(readEconomicShopEarnings(h.db, 'A', 'shop-A')).rejects.toThrow('capture requires reconciliation');
  });
  it('rejects a settled refund with a changed journal instead of substituting ledger zeroes', async () => {
    const h = fixture(), request = h.refund(planQuantityRefund(h.quote, [{ partKey: 'item:line-A', quantity: 1 }]));
    if (!request.settlement) throw new Error('Fixture settlement missing');
    request.settlement.journalEntries[0].amountMinor += 1n; h.capture.refundRequests.push(request);
    await expect(readEconomicShopEarnings(h.db, 'A', 'shop-A')).rejects.toThrow('settled refund requires reconciliation');
  });
  it('rejects cumulative shop over-refunds and missing or inconsistent seller lots', async () => {
    const h = fixture(), request = h.refund(planQuantityRefund(h.quote, [{ partKey: 'item:line-A', quantity: 2 }]));
    h.capture.refundRequests.push(request, request);
    await expect(readEconomicShopEarnings(h.db, 'A', 'shop-A')).rejects.toThrow('exceed original');
    const other = fixture(); other.lots[0].amountMinor += 1n;
    await expect(readEconomicShopEarnings(other.db, 'A', 'shop-A')).rejects.toThrow('seller lot requires reconciliation');
  });
  it('distinguishes original payout and debt recovery allocations from net allocation after refunds', async () => {
    const h = fixture(); h.lots[0].paidMinor = 100n; h.lots[0].reservedMinor = 30n; h.lots[0].debtRecoveredMinor = 20n;
    expect(await readEconomicShopEarnings(h.db, 'A', 'shop-A')).toMatchObject({ amounts: {
      netSellerAllocationMinor: '180', paidMinor: '100', reservedMinor: '30', debtRecoveredMinor: '20' } });
  });
});
