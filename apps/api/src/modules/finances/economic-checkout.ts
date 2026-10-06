import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { EconomicProvenance, Prisma } from '@prisma/client';
import { PLATFORM_FEE_DEFAULTS } from '../stores/fees.util';
import { allocateMinorUnits, parseMinorUnits } from './economic-policy';
import { persistEconomicQuote } from './economic-capture';
import { canonicalEconomicJson, QuoteStoreInput } from './economic-quote';

export function economicMode(): EconomicProvenance {
  const mode = process.env['ECONOMIC_V1_MODE'];
  if (mode !== 'TEST' && mode !== 'LIVE') throw new BadRequestException('Economic payment mode is not configured');
  return mode;
}
export function economicEnabled() { return process.env['ECONOMIC_V1_ENABLED'] === 'true'; }
export function requireEconomicCheckout(giftCardCode?: string) {
  if (!economicEnabled()) throw new BadRequestException('Online payment is unavailable until economic rollout is enabled');
  economicMode();
  if (giftCardCode) throw new BadRequestException('Gift-card and split-tender checkout are unavailable; no balance has been deducted');
}

/** Frozen from rows written in this checkout transaction, never buyer-supplied money. */
export async function freezeCheckoutEconomics(tx: Prisma.TransactionClient, orderId: string, giftWrapMinor: bigint) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, storeOrders: true } });
  if (!order.storeOrders.length || order.items.some(line => !line.storeOrderId || !line.storeId || !line.productId)) throw new BadRequestException('All order items must belong to an existing product and shop');
  const settings = await tx.platformSettings.findUnique({ where: { id: 'singleton' } });
  const stores = await tx.store.findMany({ where: { id: { in: order.storeOrders.map(s => s.storeId) } }, select: { id: true, country: true } });
  const minor = (value: Prisma.Decimal | number | string) => parseMinorUnits(value.toString(), 2);
  const sellerDiscount = order.storeOrders.reduce((sum, shop) => sum + minor(shop.discountAmount), 0n);
  const globalDiscount = minor(order.discountAmount) - sellerDiscount + minor(order.affiliateDiscountAmount ?? 0);
  if (globalDiscount < 0n) throw new Error('Discount funding does not reconcile');
  const grossByShop = order.storeOrders.map(shop => ({ id: shop.id, weight: minor(shop.subtotal) - minor(shop.discountAmount) }));
  const totalMerchandise = grossByShop.reduce((sum, row) => sum + row.weight, 0n);
  if (globalDiscount > totalMerchandise) throw new BadRequestException('Combined discounts exceed merchandise');
  const globalParts = new Map(allocateMinorUnits(globalDiscount, grossByShop).map(row => [row.id, row.amount]));
  const wraps = new Map(allocateMinorUnits(giftWrapMinor, grossByShop).map(row => [row.id, row.amount]));
  const rates = {
    transaction: (settings?.transactionFeeRate ?? new Prisma.Decimal(PLATFORM_FEE_DEFAULTS.transactionFeeRate)).toString(),
    processing: (settings?.paymentProcessingFeeRate ?? new Prisma.Decimal(PLATFORM_FEE_DEFAULTS.paymentProcessingFeeRate)).toString(),
    fixed: (settings?.paymentProcessingFixedFee ?? new Prisma.Decimal(PLATFORM_FEE_DEFAULTS.paymentProcessingFixedFee)).toString(),
    regulatory: (settings?.regulatoryFeeRate ?? new Prisma.Decimal(PLATFORM_FEE_DEFAULTS.regulatoryFeeRate)).toString(),
    countries: settings?.regulatoryFeeCountries ?? PLATFORM_FEE_DEFAULTS.regulatoryFeeCountries,
    vat: (settings?.vatOnFeesRate ?? new Prisma.Decimal(PLATFORM_FEE_DEFAULTS.vatOnFeesRate)).toString(),
  };
  const ruleReference = createHash('sha256').update(canonicalEconomicJson(rates)).digest('hex');
  const rateFee = (base: bigint, rate: string) => {
    const decimal = new Prisma.Decimal(rate);
    if (decimal.isNegative() || decimal.greaterThan(1)) throw new Error('Invalid configured fee rate');
    return BigInt(new Prisma.Decimal(base.toString()).mul(decimal).toFixed(0, Prisma.Decimal.ROUND_HALF_UP));
  };
  const quotedStores: QuoteStoreInput[] = order.storeOrders.map(shop => {
    const lines = order.items.filter(item => item.storeOrderId === shop.id);
    const sellerParts = new Map(allocateMinorUnits(minor(shop.discountAmount), lines.map(line => ({ id: line.id, weight: minor(line.unitPrice) * BigInt(line.quantity) }))).map(row => [row.id, row.amount]));
    const platformParts = new Map(allocateMinorUnits(globalParts.get(shop.id) ?? 0n, lines.map(line => ({ id: line.id,
      weight: minor(line.unitPrice) * BigInt(line.quantity) - (sellerParts.get(line.id) ?? 0n) }))).map(row => [row.id, row.amount]));
    const shipping = minor(shop.shippingCost) - minor(shop.shippingSubsidy);
    if (shipping < 0n) throw new Error('Shipping funding does not reconcile');
    // Preserve existing fee base: net seller merchandise + customer shipping.
    const base = minor(shop.subtotal) - minor(shop.discountAmount) + shipping;
    const transaction = rateFee(base, rates.transaction);
    const processing = rateFee(base, rates.processing) + minor(rates.fixed);
    const country = stores.find(store => store.id === shop.storeId)?.country;
    const regulatory = country && rates.countries.includes(country.toUpperCase()) ? rateFee(base, rates.regulatory) : 0n;
    const vat = rateFee(transaction + processing + regulatory, rates.vat);
    return { storeId: shop.storeId, storeOrderId: shop.id,
      lines: lines.map(line => {
        if (!line.productId) throw new BadRequestException('Order product is missing');
        return { id: line.id, productId: line.productId, variantId: line.variantId,
        quantity: line.quantity, unitPriceMinor: minor(line.unitPrice).toString(), sellerDiscountMinor: (sellerParts.get(line.id) ?? 0n).toString(),
        platformDiscountMinor: (platformParts.get(line.id) ?? 0n).toString() };
      }),
      customerShippingMinor: shipping.toString(), expectedShippingSubsidyMinor: minor(shop.shippingSubsidy).toString(),
      giftWrapMinor: (wraps.get(shop.id) ?? 0n).toString(), fees: [
        ['TRANSACTION_FEE', transaction], ['PAYMENT_PROCESSING_FEE', processing], ['REGULATORY_FEE', regulatory], ['VAT', vat],
      ].map(([code, amount]) => ({ code: String(code), amountMinor: String(amount), ruleReference })),
    };
  });
  let affiliate = null;
  if (order.affiliateId) {
    const owner = await tx.affiliateAccount.findUniqueOrThrow({ where: { id: order.affiliateId } });
    const policy = await tx.affiliateSettings.findUnique({ where: { id: 'singleton' } });
    const rate = (owner.commissionRate ?? policy?.defaultRate ?? new Prisma.Decimal('0.10')).toString();
    affiliate = { id: owner.id, rate, lockDays: policy?.lockDays ?? 14,
      commissionMinor: rateFee(minor(order.subtotal) - minor(order.discountAmount), rate).toString(),
      ruleReference: createHash('sha256').update(`${rate}:${policy?.lockDays ?? 14}`).digest('hex') };
  }
  return persistEconomicQuote(tx, { orderId, currency: 'USD', minorExponent: 2, stores: quotedStores,
    tax: { amountMinor: '0', ruleReference: 'checkout:no-customer-tax-collected.v1' }, affiliate }, economicMode());
}
