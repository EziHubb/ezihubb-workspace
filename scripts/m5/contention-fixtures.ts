import { randomBytes } from 'node:crypto';
import { Prisma, PrismaClient, Product, ProductVariant, Store } from '@prisma/client';
import { minorDecimal } from '../../apps/api/src/modules/finances/economic-balance';
import { persistEconomicQuote } from '../../apps/api/src/modules/finances/economic-capture';
import { prepareEconomicOperation } from '../../apps/api/src/modules/finances/economic-durability';
import { QuoteInput } from '../../apps/api/src/modules/finances/economic-quote';

export async function createCatalog(db: PrismaClient, runId: string, name: string) {
  const tag = `m52-${runId}-${name}`;
  return db.$transaction(async tx => {
    const buyer = await tx.user.create({ data: { email: `${tag}-buyer@ezihubb.test`, backupCodes: [], adminTags: [], isEmailVerified: true } });
    const admin = await tx.user.create({ data: { email: `${tag}-admin@ezihubb.test`, role: 'SUPER_ADMIN', backupCodes: [], adminTags: [] } });
    const stores: Store[] = [];
    for (const suffix of ['a', 'b']) {
      const owner = await tx.user.create({ data: { email: `${tag}-${suffix}@ezihubb.test`, role: 'ADMIN', isSeller: true, backupCodes: [], adminTags: [] } });
      const store = await tx.store.create({ data: { slug: `${tag}-${suffix}`, name: 'M5.2 synthetic', ownerId: owner.id,
        status: 'ACTIVE', moderationStatus: 'CLEAN', fulfillmentMode: 'MANUAL', aboutPhotoUrls: [], featuredProductIds: [] } });
      await tx.user.update({ where: { id: owner.id }, data: { storeId: store.id } });
      stores.push(store);
    }
    const affiliate = await tx.affiliateAccount.create({ data: { email: `${tag}-affiliate@ezihubb.test`,
      firstName: 'Synthetic', lastName: 'M5.2', referralCode: randomBytes(12).toString('hex'), status: 'ACTIVE' } });
    const category = await tx.category.create({ data: { name: 'M5.2 synthetic', slug: tag } });
    return { buyer, admin, stores, affiliate, category, tag };
  });
}
export type Catalog = Awaited<ReturnType<typeof createCatalog>>;
export async function createProduct(db: PrismaClient, catalog: Catalog, input: {
  name: string; store?: number; quantity?: number | null; unlimited?: boolean; digital?: boolean; variant?: boolean;
}) {
  const product = await db.product.create({ data: { name: `M5.2 ${input.name}`, slug: `${catalog.tag}-${input.name}`,
    sku: `${catalog.tag}-${input.name}`, description: 'Isolated synthetic test only', basePrice: '10.00',
    categoryId: catalog.category.id, storeId: catalog.stores[input.store ?? 0].id, status: 'ACTIVE',
    productType: input.digital ? 'DIGITAL' : 'PHYSICAL', trackInventory: !input.unlimited, quantity: input.unlimited ? null : input.quantity ?? 20,
    isPersonalizable: false, primaryColors: [], secondaryColors: [], materials: [], occasions: [], holidayTags: [],
    recipientTags: [], styles: [], sustainability: [], videoUrls: [] } });
  let variant: ProductVariant | null = null;
  if (input.variant) {
    variant = await db.productVariant.create({ data: { productId: product.id, name: 'Synthetic variant', options: { Size: 'S' }, quantity: 1, price: '10.00' } });
    await db.variationSettings.create({ data: { productId: product.id, enableVariations: true, variesBy: ['quantity'] } });
  }
  return { product, variant };
}
export type ScenarioLine = { product: Product; variant?: ProductVariant | null; quantity: number };
export async function createOrder(db: PrismaClient, catalog: Catalog, lines: ScenarioLine[], options: {
  wrap?: boolean; shipping?: boolean; affiliate?: boolean; guest?: boolean;
} = {}) {
  return db.$transaction(async tx => {
    const stores = [...new Set(lines.map(line => {
      if (!line.product.storeId) throw new Error('M5_SCENARIO_STORE_REQUIRED');
      return line.product.storeId;
    }))].sort();
    const subtotal = lines.reduce((sum, line) => sum + BigInt(line.quantity) * 1000n, 0n);
    const shipping = options.shipping ? 500n * BigInt(stores.length) : 0n;
    const wrap = options.wrap ? 300n * BigInt(stores.length) : 0n;
    const total = subtotal + shipping + wrap;
    const order = await tx.order.create({ data: { orderNumber: `M52-${randomBytes(12).toString('hex')}`,
      ...(options.guest ? { guestEmail: `${catalog.tag}-guest@ezihubb.test` } : { userId: catalog.buyer.id }),
      status: 'PENDING_PAYMENT', shippingName: 'Synthetic', shippingAddress: '1 Test Street', shippingCity: 'Test',
      shippingCountry: 'US', shippingZip: '00000', subtotal: minorDecimal(subtotal, 2), shippingCost: minorDecimal(shipping, 2),
      total: minorDecimal(total, 2), note: 'M5.2 synthetic provider proof; NOT a real payment' } });
    const input: QuoteInput = { orderId: order.id, currency: 'USD', minorExponent: 2, stores: [],
      tax: { amountMinor: '0', ruleReference: 'm5.2-synthetic-zero-tax' },
      affiliate: options.affiliate ? { id: catalog.affiliate.id, commissionMinor: '50', rate: '0.01', lockDays: 1, ruleReference: 'm5.2-test-only' } : null };
    for (const storeId of stores) {
      const own = lines.filter(line => line.product.storeId === storeId);
      const shop = await tx.storeOrder.create({ data: { orderId: order.id, storeId, status: 'PENDING_PAYMENT',
        subtotal: minorDecimal(own.reduce((sum, line) => sum + BigInt(line.quantity) * 1000n, 0n), 2),
        shippingCost: options.shipping ? '5.00' : '0.00', platformFee: '0.00', sellerEarnings: '0.00' } });
      const quoteLines = [];
      for (const line of own) {
        const item = await tx.orderItem.create({ data: { orderId: order.id, storeOrderId: shop.id, storeId,
          productId: line.product.id, variantId: line.variant?.id, quantity: line.quantity, unitPrice: '10.00',
          productName: line.product.name, sku: line.product.sku } });
        quoteLines.push({ id: item.id, productId: line.product.id, variantId: line.variant?.id ?? null, quantity: line.quantity,
          unitPriceMinor: '1000', sellerDiscountMinor: '0', platformDiscountMinor: '0' });
      }
      input.stores.push({ storeId, storeOrderId: shop.id, lines: quoteLines, customerShippingMinor: options.shipping ? '500' : '0',
        expectedShippingSubsidyMinor: '0', giftWrapMinor: options.wrap ? '300' : '0',
        fees: [{ code: 'TRANSACTION_FEE', amountMinor: '101', ruleReference: 'm5.2-rounding-test-only' }] });
    }
    const context = await persistEconomicQuote(tx, input, 'TEST');
    const payment = await tx.payment.create({ data: { orderId: order.id, method: 'STRIPE', status: 'PENDING', amount: minorDecimal(total, 2),
      currency: 'USD', stripePaymentIntentId: `pi_m52${randomBytes(12).toString('hex')}` } });
    const operation = await prepareEconomicOperation(tx, { contextId: context.id, provenance: 'TEST', currency: 'USD',
      provider: 'STRIPE', providerAccount: 'acct_m52_synthetic', kind: 'CAPTURE', idempotencyKey: `m52:${order.id}`,
      requestHash: context.quoteHash, amountMinor: total });
    return { order, context, payment, operation, quote: context.quote as unknown as import('../../apps/api/src/modules/finances/economic-quote').EconomicQuote };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export type ScenarioOrder = Awaited<ReturnType<typeof createOrder>>;
export function captureReader(order: ScenarioOrder) {
  const chargeId = `ch_m52${order.order.id}`;
  return { scope: { providerAccount: 'acct_m52_synthetic', provenance: 'TEST' as const }, read: async () => ({
    id: order.payment.stripePaymentIntentId, status: 'succeeded', livemode: false,
    amount: Number(order.operation.amountMinor), amount_received: Number(order.operation.amountMinor), currency: 'usd',
    metadata: { orderId: order.order.id, economicOperationId: order.operation.id, quoteHash: order.context.quoteHash },
    latest_charge: { id: chargeId, payment_intent: order.payment.stripePaymentIntentId, livemode: false, status: 'succeeded', paid: true,
      captured: true, amount_captured: Number(order.operation.amountMinor), amount_refunded: 0, refunded: false, disputed: false, currency: 'usd' },
  }) };
}
