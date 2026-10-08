import { Prisma } from '@prisma/client';
import { economicEnabled, freezeCheckoutEconomics, requireEconomicCheckout } from './economic-checkout';
import { EconomicQuote } from './economic-quote';
import { reserveEconomicInventoryInTransaction } from '../products/inventory-reservation';
jest.mock('../products/inventory-reservation',()=>({reserveEconomicInventoryInTransaction:jest.fn().mockResolvedValue([])}));

const decimal = (value: string) => new Prisma.Decimal(value);
function harness() {
  const order = { id: 'order', status: 'PENDING_PAYMENT', payment: null, subtotal: decimal('30'), discountAmount: decimal('5'),
    affiliateId: null as string | null, affiliateDiscountAmount: decimal('0'), total: decimal('32'),
    storeOrders: [
      { id: 'shop-a', storeId: 'store-a', subtotal: decimal('20'), discountAmount: decimal('2'), shippingCost: decimal('5'), shippingSubsidy: decimal('5') },
      { id: 'shop-b', storeId: 'store-b', subtotal: decimal('10'), discountAmount: decimal('0'), shippingCost: decimal('5'), shippingSubsidy: decimal('0') },
    ],
    items: [
      { id: 'line-a', storeOrderId: 'shop-a', storeId: 'store-a', productId: 'product-a', variantId: null, quantity: 2, unitPrice: decimal('10') },
      { id: 'line-b', storeOrderId: 'shop-b', storeId: 'store-b', productId: 'product-b', variantId: null, quantity: 1, unitPrice: decimal('10') },
    ],
  };
  const settings = { transactionFeeRate: decimal('0.065'), paymentProcessingFeeRate: decimal('0.03'), paymentProcessingFixedFee: decimal('0.30'),
    regulatoryFeeRate: decimal('0'), regulatoryFeeCountries: [], vatOnFeesRate: decimal('0.10') };
  const tx = { order: { findUniqueOrThrow: jest.fn(async () => order) }, platformSettings: { findUnique: jest.fn(async () => settings) },
    store: { findMany: jest.fn().mockResolvedValue([{ id: 'store-a', country: 'US' }, { id: 'store-b', country: 'US' }]) },
    affiliateAccount: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'affiliate', commissionRate: decimal('0.15') }) },
    affiliateSettings: { findUnique: jest.fn().mockResolvedValue({ defaultRate: decimal('0.10'), lockDays: 7 }) },
    sellerLedgerEntry: { count: jest.fn().mockResolvedValue(0) },
    economicOrderContext: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => ({ id: 'context', ...data })) },
  };
  return { order, settings, tx, transaction: tx as unknown as Prisma.TransactionClient };
}

describe('checkout economic snapshot from authoritative saved rows', () => {
  const before = { enabled: process.env['ECONOMIC_V1_ENABLED'], mode: process.env['ECONOMIC_V1_MODE'] };
  beforeEach(() => { process.env['ECONOMIC_V1_MODE'] = 'TEST'; process.env['ECONOMIC_V1_ENABLED'] = 'true'; });
  afterAll(() => {
    if (before.enabled === undefined) delete process.env['ECONOMIC_V1_ENABLED']; else process.env['ECONOMIC_V1_ENABLED'] = before.enabled;
    if (before.mode === undefined) delete process.env['ECONOMIC_V1_MODE']; else process.env['ECONOMIC_V1_MODE'] = before.mode;
  });
  it('freezes multi-shop quantity, seller/platform discount, supported shipping and wrap funding exactly', async () => {
    const h = harness(); const result = await freezeCheckoutEconomics(h.transaction, 'order', 200n);
    const quote = result.quote as unknown as EconomicQuote;
    expect(quote.customerTotalMinor).toBe('3200');
    expect(quote.platformFundingMinor).toBe('300');
    expect(quote.expectedShippingSubsidyMinor).toBe('500');
    expect(quote.sellerGrossMinor).toBe('3500'); // No 500-cent subsidy credited to seller.
    expect(quote.stores.find(s => s.storeId === 'store-a')?.customerShippingMinor).toBe('0');
    expect(quote.parts.reduce((sum: bigint, part: { customerMinor: string }) => sum + BigInt(part.customerMinor), 0n)).toBe(3200n);
    expect(BigInt(quote.sellerNetMinor) + BigInt(quote.sellerFeeMinor)).toBe(3500n);
    expect(quote.providerCost).toBe('UNRECONCILED');
    expect(reserveEconomicInventoryInTransaction).toHaveBeenCalledWith(h.transaction, 'context');
  });
  it('preserves affiliate rate/lock and separates buyer discount from original commission base', async () => {
    const h = harness(); h.order.affiliateId = 'affiliate'; h.order.affiliateDiscountAmount = decimal('1'); h.order.total = decimal('31');
    const result = await freezeCheckoutEconomics(h.transaction, 'order', 200n);
    const quote = result.quote as unknown as EconomicQuote;
    expect(quote.affiliate).toMatchObject({ id: 'affiliate', rate: '0.15', lockDays: 7, commissionMinor: '375' });
    expect(quote.platformFundingMinor).toBe('400'); expect(quote.customerTotalMinor).toBe('3100');
  });
  it('rejects a missing shop/product and discounts/subsidies that do not reconcile', async () => {
    const h = harness(); h.order.items[0].storeId = '';
    await expect(freezeCheckoutEconomics(h.transaction, 'order', 200n)).rejects.toThrow('existing product and shop');
    h.order.items[0].storeId = 'store-a'; h.order.storeOrders[0].shippingSubsidy = decimal('6');
    await expect(freezeCheckoutEconomics(h.transaction, 'order', 200n)).rejects.toThrow('Shipping funding');
    h.order.storeOrders[0].shippingSubsidy = decimal('5'); h.order.discountAmount = decimal('40');
    await expect(freezeCheckoutEconomics(h.transaction, 'order', 200n)).rejects.toThrow('Combined discounts');
    expect(h.tx.economicOrderContext.create).not.toHaveBeenCalled();
  });
  it('rejects changed order totals and never upgrades a manual order into collected funds', async () => {
    const h = harness(); h.order.total = decimal('32.01');
    await expect(freezeCheckoutEconomics(h.transaction, 'order', 200n)).rejects.toThrow('no longer matches');
    h.order.total = decimal('32'); h.order.status = 'CONFIRMED';
    await expect(freezeCheckoutEconomics(h.transaction, 'order', 200n)).rejects.toThrow('new unpaid');
  });
  it('requires explicit rollout/mode and blocks unsupported tender before deductions', () => {
    expect(economicEnabled()).toBe(true); expect(() => requireEconomicCheckout()).not.toThrow();
    expect(() => requireEconomicCheckout('gift')).toThrow('no balance has been deducted');
    process.env['ECONOMIC_V1_MODE'] = 'unknown'; expect(() => requireEconomicCheckout()).toThrow('not configured');
    process.env['ECONOMIC_V1_ENABLED'] = 'false'; expect(() => requireEconomicCheckout()).toThrow('unavailable');
  });
});
