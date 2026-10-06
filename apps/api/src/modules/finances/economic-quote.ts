import { createHash } from 'node:crypto';
import { allocateMinorUnits, ECONOMIC_POLICY_VERSION } from './economic-policy';

const MAX_MINOR = 9223372036854775807n;
export type QuoteLineInput = {
  id: string; productId: string; variantId: string | null; quantity: number;
  unitPriceMinor: string; sellerDiscountMinor: string; platformDiscountMinor: string;
};
export type QuoteStoreInput = {
  storeId: string; storeOrderId: string; lines: QuoteLineInput[];
  customerShippingMinor: string; expectedShippingSubsidyMinor: string; giftWrapMinor: string;
  fees: Array<{ code: string; amountMinor: string; ruleReference: string }>;
};
export type QuoteInput = {
  orderId: string; currency: string; minorExponent: number;
  stores: QuoteStoreInput[];
  // Explicit rule/evidence reference is required even for a zero-tax quote.
  tax: { amountMinor: string; ruleReference: string };
  affiliate: { id: string; commissionMinor: string; rate: string; lockDays: number; ruleReference: string } | null;
};
export type QuotePart = {
  key: string; kind: 'ITEM' | 'SHIPPING' | 'GIFT_WRAP';
  storeId: string; storeOrderId: string; lineId: string | null;
  productId: string | null; variantId: string | null; quantity: number;
  customerMinor: string; platformFundingMinor: string; sellerGrossMinor: string;
  sellerFeeMinor: string; sellerNetMinor: string;
  fees: Array<{ code: string; amountMinor: string; ruleReference: string }>;
};
export type EconomicQuote = {
  version: typeof ECONOMIC_POLICY_VERSION; orderId: string; currency: string; minorExponent: number;
  stores: QuoteStoreInput[]; parts: QuotePart[]; tax: QuoteInput['tax']; affiliate: QuoteInput['affiliate'];
  customerTotalMinor: string; platformFundingMinor: string; sellerGrossMinor: string;
  sellerFeeMinor: string; sellerNetMinor: string; expectedShippingSubsidyMinor: string;
  providerCost: 'UNRECONCILED';
};

/** JSONB does not preserve object-key order. Arrays retain business ordering. */
export function canonicalEconomicJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalEconomicJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalEconomicJson(record[key])}`).join(',')}}`;
  }
  throw new Error('Unsupported economic JSON value');
}

export function exactMinor(value: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) throw new Error('Expected canonical minor-unit string');
  const result = BigInt(value);
  if (result > MAX_MINOR) throw new Error('Money exceeds database capacity');
  return result;
}

function identifier(value: string): string {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 150) {
    throw new Error('Invalid quote identifier');
  }
  return value;
}

function ordinal(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }
function money(value: bigint) { return exactMinor(value.toString()).toString(); }

/** Server-internal builder. Never accept fees, provenance or funding from a buyer DTO. */
export function buildEconomicQuote(input: QuoteInput): EconomicQuote {
  identifier(input.orderId);
  if (!/^[A-Z]{3}$/.test(input.currency) || !Number.isInteger(input.minorExponent)
    || input.minorExponent < 0 || input.minorExponent > 3 || !input.stores.length) {
    throw new Error('Invalid quote currency or stores');
  }
  const seenStores = new Set<string>();
  const seenStoreOrders = new Set<string>();
  const seenLines = new Set<string>();
  const parts: QuotePart[] = [];
  const stores: QuoteStoreInput[] = [];
  let expectedShipping = 0n;
  for (const source of [...input.stores].sort((a, b) => ordinal(a.storeId, b.storeId))) {
    const storeId = identifier(source.storeId);
    const storeOrderId = identifier(source.storeOrderId);
    if (seenStores.has(storeId) || seenStoreOrders.has(storeOrderId) || !source.lines.length) {
      throw new Error('Duplicate or empty quote store');
    }
    seenStores.add(storeId); seenStoreOrders.add(storeOrderId);
    const storeParts: QuotePart[] = [];
    const addPart = (key: string, kind: QuotePart['kind'], line: QuoteLineInput | null, customer: bigint, funding: bigint) => {
      storeParts.push({ key, kind, storeId, storeOrderId, lineId: line?.id ?? null,
        productId: line?.productId ?? null, variantId: line?.variantId ?? null, quantity: line?.quantity ?? 1,
        customerMinor: money(customer), platformFundingMinor: money(funding), sellerGrossMinor: money(customer + funding),
        sellerFeeMinor: '0', sellerNetMinor: money(customer + funding), fees: [],
      });
    };
    const lines = source.lines.map(line => {
      identifier(line.id); identifier(line.productId);
      if (line.variantId !== null) identifier(line.variantId);
      if (seenLines.has(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || line.quantity > 2147483647) {
        throw new Error('Invalid or duplicate quote line');
      }
      seenLines.add(line.id);
      const gross = exactMinor(line.unitPriceMinor) * BigInt(line.quantity);
      const sellerDiscount = exactMinor(line.sellerDiscountMinor);
      const platformDiscount = exactMinor(line.platformDiscountMinor);
      if (sellerDiscount + platformDiscount > gross) throw new Error('Line discount exceeds merchandise');
      const clean = { id: line.id, productId: line.productId, variantId: line.variantId, quantity: line.quantity,
        unitPriceMinor: money(exactMinor(line.unitPriceMinor)), sellerDiscountMinor: money(sellerDiscount),
        platformDiscountMinor: money(platformDiscount) };
      addPart(`item:${line.id}`, 'ITEM', clean, gross - sellerDiscount - platformDiscount, platformDiscount);
      return clean;
    }).sort((a, b) => ordinal(a.id, b.id));
    const shipping = exactMinor(source.customerShippingMinor);
    const subsidy = exactMinor(source.expectedShippingSubsidyMinor);
    const wrap = exactMinor(source.giftWrapMinor);
    expectedShipping += subsidy;
    if (shipping > 0n) addPart(`shipping:${storeOrderId}`, 'SHIPPING', null, shipping, 0n);
    if (wrap > 0n) addPart(`gift-wrap:${storeOrderId}`, 'GIFT_WRAP', null, wrap, 0n);
    const seenFees = new Set<string>();
    const fees = source.fees.map(fee => {
      identifier(fee.code); identifier(fee.ruleReference);
      if (seenFees.has(fee.code) || !['TRANSACTION_FEE', 'PAYMENT_PROCESSING_FEE', 'REGULATORY_FEE', 'VAT'].includes(fee.code)) {
        // Listing/marketing/share-save require their own evidence/beneficiary
        // contracts; they cannot be silently booked as generic platform revenue.
        throw new Error('Unsupported or duplicate order fee');
      }
      seenFees.add(fee.code);
      return { code: fee.code, amountMinor: money(exactMinor(fee.amountMinor)), ruleReference: fee.ruleReference };
    }).sort((a, b) => ordinal(a.code, b.code));
    // Bound the aggregate first, then allocate fees sequentially against remaining
    // proceeds: independent rounding of many fees must not overdraw a 1-cent line.
    const grossTotal = storeParts.reduce((sum, part) => sum + exactMinor(part.sellerGrossMinor), 0n);
    if (fees.reduce((sum, fee) => sum + exactMinor(fee.amountMinor), 0n) > grossTotal) throw new Error('Fees exceed seller gross');
    for (const fee of fees) {
      const allocation = new Map(allocateMinorUnits(exactMinor(fee.amountMinor),
        storeParts.map(part => ({ id: part.key, weight: exactMinor(part.sellerNetMinor) })))
        .map(row => [row.id, row.amount]));
      for (const part of storeParts) {
        const amount = allocation.get(part.key) ?? 0n;
        part.fees.push({ ...fee, amountMinor: amount.toString() });
        part.sellerFeeMinor = money(exactMinor(part.sellerFeeMinor) + amount);
        part.sellerNetMinor = money(exactMinor(part.sellerNetMinor) - amount);
      }
    }
    parts.push(...storeParts);
    stores.push({ storeId, storeOrderId, lines, customerShippingMinor: money(shipping),
      expectedShippingSubsidyMinor: money(subsidy), giftWrapMinor: money(wrap), fees });
  }
  identifier(input.tax.ruleReference);
  const tax = { amountMinor: money(exactMinor(input.tax.amountMinor)), ruleReference: input.tax.ruleReference };
  let affiliate: QuoteInput['affiliate'] = null;
  if (input.affiliate) {
    const source = input.affiliate;
    identifier(source.id); identifier(source.ruleReference);
    if (!/^(0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/.test(source.rate)
      || !Number.isSafeInteger(source.lockDays) || source.lockDays < 0) throw new Error('Invalid affiliate policy');
    affiliate = { id: source.id, commissionMinor: money(exactMinor(source.commissionMinor)),
      rate: source.rate, lockDays: source.lockDays, ruleReference: source.ruleReference };
  }
  parts.sort((a, b) => ordinal(a.key, b.key));
  const sum = (field: 'customerMinor' | 'platformFundingMinor' | 'sellerGrossMinor' | 'sellerFeeMinor' | 'sellerNetMinor') =>
    parts.reduce((total, part) => total + exactMinor(part[field]), 0n);
  return {
    version: ECONOMIC_POLICY_VERSION, orderId: input.orderId, currency: input.currency, minorExponent: input.minorExponent,
    stores, parts, tax, affiliate,
    customerTotalMinor: money(sum('customerMinor') + exactMinor(tax.amountMinor)),
    platformFundingMinor: money(sum('platformFundingMinor')), sellerGrossMinor: money(sum('sellerGrossMinor')),
    sellerFeeMinor: money(sum('sellerFeeMinor')), sellerNetMinor: money(sum('sellerNetMinor')),
    expectedShippingSubsidyMinor: money(expectedShipping), providerCost: 'UNRECONCILED',
  };
}

export function quoteFingerprint(quote: EconomicQuote): string {
  // Rebuild both normalizes ordering and refuses inconsistent derived totals/parts.
  const normalized = buildEconomicQuote(quote);
  if (canonicalEconomicJson(normalized) !== canonicalEconomicJson(quote)) throw new Error('Quote snapshot is not canonical');
  return createHash('sha256').update(canonicalEconomicJson(normalized)).digest('hex');
}
