import { Prisma } from '@prisma/client';
import { buildEconomicQuote } from './economic-quote';
import { planQuantityRefund, SHIPPING_REFUND_POLICY, ShippingRefundEligibility } from './economic-refund-plan';
import { plannedRefundJournal } from './economic-refund-journal';
import { shippingRefundEligible, verifiedShippingRefundEligibility } from './economic-shipping-refund';

const quote = buildEconomicQuote({ orderId: 'order', currency: 'USD', minorExponent: 2,
  stores: ['a', 'b'].map(id => ({ storeId: id, storeOrderId: `shop-${id}`,
    lines: [{ id, productId: id, variantId: null, quantity: 2, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
    customerShippingMinor: '50', expectedShippingSubsidyMinor: '500', giftWrapMinor: '10',
    fees: [{ code: 'TRANSACTION_FEE', amountMinor: '13', ruleReference: 'original' }] })),
  tax: { amountMinor: '0', ruleReference: 'original' },
  affiliate: { id: 'affiliate', commissionMinor: '40', rate: '0.1', lockDays: 14, ruleReference: 'original' } });
const selection = [{ partKey: 'item:a', quantity: 2 }, { partKey: 'shipping:shop-a', quantity: 1 }];
const eligibility: ShippingRefundEligibility = { policy: SHIPPING_REFUND_POLICY, storeOrderIds: ['shop-a'], previousItemQuantities: { 'item:a': 0 } };
function fixture() {
  const shop = { id: 'shop-a', orderId: 'order', storeId: 'a', status: 'CANCELLED',
    shippedAt: null, deliveredAt: null, trackingNumber: null, trackingUrl: null, carrier: null, fulfillments: [] as unknown[] };
  const tx = { $queryRaw: jest.fn().mockResolvedValue([]),
    storeOrder: { findUnique: jest.fn().mockResolvedValue(shop) },
    order: { findUniqueOrThrow: jest.fn().mockResolvedValue({ shippedAt: null, deliveredAt: null }) },
    economicExternalEffect: { count: jest.fn().mockResolvedValue(0) },
    orderStatusHistory: { count: jest.fn().mockResolvedValue(0) } };
  return { shop, raw: tx, tx: tx as unknown as Prisma.TransactionClient };
}
describe('full-shop pre-handoff original shipping refund', () => {
  it('reverses original customer shipping/fees without subsidy, gift wrap or another shop', () => {
    const plan = planQuantityRefund(quote, selection, new Map(), undefined, eligibility);
    expect(plan.customerMinor).toBe('250'); expect(plan.affiliateMinor).toBe('20');
    expect(plan.parts.map(part => part.storeId)).toEqual(['a', 'a']);
    expect(plan.parts.every(part => part.platformFundingMinor === '0')).toBe(true);
    expect(plan.parts.find(part => part.lineId === null)?.affiliateMinor).toBe('0');
    expect(plan.giftWrapApproval).toBeUndefined();
    expect(plannedRefundJournal(plan, quote).reduce((sum, row) => sum + BigInt(row.amountMinor), 0n)).toBe(0n);
  });
  it('supports shipping-only refund after all original items were verifiably refunded', () => {
    const plan = planQuantityRefund(quote, [selection[1]], new Map([['item:a', 2]]), undefined,
      { ...eligibility, previousItemQuantities: { 'item:a': 2 } });
    expect(plan.customerMinor).toBe('50'); expect(plan.affiliateMinor).toBe('0');
    expect(plannedRefundJournal(plan, quote).reduce((sum, row) => sum + BigInt(row.amountMinor), 0n)).toBe(0n);
  });
  it('rejects partial shop refunds, missing proof, foreign scope and forged settled quantities', () => {
    expect(() => planQuantityRefund(quote, selection)).toThrow('server-verified');
    expect(() => planQuantityRefund(quote, [{ ...selection[0], quantity: 1 }, selection[1]], new Map(), undefined, eligibility)).toThrow('every original');
    expect(() => planQuantityRefund(quote, selection, new Map(), undefined, { ...eligibility, storeOrderIds: ['shop-b'] })).toThrow('server-verified');
    expect(() => planQuantityRefund(quote, selection, new Map(), undefined, { ...eligibility, previousItemQuantities: { 'item:a': 2 } })).toThrow('server-verified');
    expect(() => planQuantityRefund(quote, [selection[1]], new Map([['item:a', 2], [selection[1].partKey, 1]]), undefined,
      { ...eligibility, previousItemQuantities: { 'item:a': 2 } })).toThrow('exceeds');
  });
  it('locks context/order/shop and verifies server-owned evidence', async () => {
    const h = fixture();
    expect(await verifiedShippingRefundEligibility(h.tx, 'context', quote, selection, new Map())).toEqual(eligibility);
    expect(h.raw.$queryRaw).toHaveBeenCalledTimes(3);
    h.shop.status = 'CONFIRMED';
    await expect(verifiedShippingRefundEligibility(h.tx, 'context', quote, selection, new Map())).rejects.toThrow('no handoff');
  });
  it.each(['shippedAt', 'deliveredAt', 'trackingNumber', 'trackingUrl', 'carrier', 'fulfillments', 'storeId', 'orderId'])(
    'holds incomplete or handed-off evidence: %s', async field => {
      const h = fixture(); Object.assign(h.shop, { [field]: field === 'fulfillments' ? [{ status: 'PENDING' }] : 'present-or-foreign' });
      expect(await shippingRefundEligible(h.tx, quote, 'shop-a')).toBe(false);
    });
  it('holds parent shipment history even when shop timestamps have been cleared', async () => {
    const h = fixture(); h.raw.orderStatusHistory.count.mockResolvedValue(1);
    expect(await shippingRefundEligible(h.tx, quote, 'shop-a')).toBe(false);
    h.raw.orderStatusHistory.count.mockResolvedValue(0);
    h.raw.order.findUniqueOrThrow.mockResolvedValue({ shippedAt: new Date() as never, deliveredAt: null });
    expect(await shippingRefundEligible(h.tx, quote, 'shop-a')).toBe(false);
  });
  it('holds a prepared or ambiguous versioned POD intent even without a legacy fulfillment row', async () => {
    const h = fixture(); h.raw.economicExternalEffect.count.mockResolvedValue(1);
    expect(await shippingRefundEligible(h.tx, quote, 'shop-a')).toBe(false);
  });
});
