import { createHash } from 'node:crypto';
import { allocateMinorUnits, refundByQuantity } from './economic-policy';
import { canonicalEconomicJson, EconomicQuote, exactMinor, quoteFingerprint } from './economic-quote';

export type RefundSelection = { partKey: string; quantity: number };
export const REFUND_ROUNDING_POLICY = '2026-10-08.platform-rounding.v1';
export const GIFT_WRAP_REFUND_POLICY = '2026-10-08.gift-wrap-explicit-approval.v1';
export type GiftWrapRefundApproval = { policy: typeof GIFT_WRAP_REFUND_POLICY; approvedBy: string; reason: string };
export const SHIPPING_REFUND_POLICY = '2026-10-08.full-shop-pre-handoff.v1';
export type ShippingRefundEligibility = { policy: typeof SHIPPING_REFUND_POLICY; storeOrderIds: string[];
  previousItemQuantities: Record<string, number> };
export const SHIPPING_OVERRIDE_POLICY = '2026-10-08.shipping-override.v1';
export type ShippingOverrideInput = { partKey: string; amountMinor: string; evidenceReference: string };
export type ShippingOverrideApproval = ShippingOverrideInput & { policy: typeof SHIPPING_OVERRIDE_POLICY;
  approvedBy: string; reason: string; previousCustomerMinor: string };
export type RefundRounding = {
  fundingMinor: string; beneficiaryMinor: string; feeMinor: string; platformMinor: string;
};
export type RefundPart = {
  partKey: string; storeId: string; storeOrderId: string; lineId: string | null;
  quantity: number; previousQuantity: number;
  customerMinor: string; platformFundingMinor: string; sellerGrossMinor: string;
  sellerFeeMinor: string; sellerNetMinor: string; affiliateMinor: string;
  rounding: RefundRounding;
  fees: Array<{ code: string; amountMinor: string; ruleReference: string }>;
};
export type EconomicRefundPlan = {
  version: 'refund-v1' | 'shipping-override-v1'; quoteHash: string; currency: string; minorExponent: number;
  parts: RefundPart[]; customerMinor: string; affiliateMinor: string;
  roundingPolicy: typeof REFUND_ROUNDING_POLICY; platformRoundingMinor: string;
  giftWrapApproval?: GiftWrapRefundApproval;
  shippingEligibility?: ShippingRefundEligibility;
  shippingOverrideApproval?: ShippingOverrideApproval;
};

/** Separately approved shipping exception, never goodwill or a subsidy credit.
 * Cumulative original-money floors let sequential partial exceptions telescope
 * exactly to the captured allocations, without current rates or floating point. */
export function planShippingOverride(quote: EconomicQuote, input: ShippingOverrideInput,
  previousCustomerMinor: string, actorId: string, reason: string): EconomicRefundPlan {
  const quoteHash = quoteFingerprint(quote);
  const part = quote.parts.find(row => row.key === input.partKey);
  const amount = exactMinor(input.amountMinor), previous = exactMinor(previousCustomerMinor);
  if (!part || part.kind !== 'SHIPPING' || part.quantity !== 1 || amount <= 0n
    || previous + amount > exactMinor(part.customerMinor)) throw new Error('Shipping exception exceeds remaining customer-paid shipping');
  if (exactMinor(quote.tax.amountMinor) !== 0n) throw new Error('Tax-bearing refunds require verified tax allocation');
  for (const [value, max] of [[actorId, 150], [reason, 500], [input.evidenceReference, 150]] as const) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) {
      throw new Error('Shipping exception requires authenticated actor, audit reason and evidence reference');
    }
  }
  const denominator = exactMinor(part.customerMinor);
  const delta = (value: string) => exactMinor(value) * (previous + amount) / denominator - exactMinor(value) * previous / denominator;
  const funding = delta(part.platformFundingMinor), gross = delta(part.sellerGrossMinor);
  const fee = delta(part.sellerFeeMinor), net = delta(part.sellerNetMinor);
  const fees = part.fees.map(row => ({ ...row, amountMinor: delta(row.amountMinor).toString() }));
  const rounding = platformRounding(amount, funding, gross, net, fee, fees.map(row => exactMinor(row.amountMinor)));
  return { version: 'shipping-override-v1', quoteHash, currency: quote.currency, minorExponent: quote.minorExponent,
    customerMinor: amount.toString(), affiliateMinor: '0', roundingPolicy: REFUND_ROUNDING_POLICY,
    platformRoundingMinor: rounding.platformMinor,
    shippingOverrideApproval: { ...input, policy: SHIPPING_OVERRIDE_POLICY, approvedBy: actorId, reason, previousCustomerMinor },
    parts: [{ partKey: part.key, storeId: part.storeId, storeOrderId: part.storeOrderId, lineId: part.lineId,
      quantity: 1, previousQuantity: 0, customerMinor: amount.toString(), platformFundingMinor: funding.toString(),
      sellerGrossMinor: gross.toString(), sellerFeeMinor: fee.toString(), sellerNetMinor: net.toString(), affiliateMinor: '0', fees, rounding }] };
}

export function shippingOverrideRequestHash(input: ShippingOverrideInput & { captureId: string; actorId: string; reason: string }) {
  return createHash('sha256').update(canonicalEconomicJson({ version: 'shipping-override-v1', ...input })).digest('hex');
}

export function exactSignedMinor(value: string): bigint {
  if (typeof value !== 'string' || !/^(0|-?[1-9]\d*)$/.test(value)) throw new Error('Invalid signed refund amount');
  const amount = BigInt(value);
  if (amount < -9223372036854775807n || amount > 9223372036854775807n) throw new Error('Signed refund amount exceeds storage limit');
  return amount;
}

/** Independent original cumulative floors can differ temporarily. Only these
 * exact differences belong to the platform; this is not a discretionary credit.
 * Positive journal values are platform debits (expense), negative are credits.
 */
function platformRounding(customer: bigint, funding: bigint, gross: bigint, net: bigint, fee: bigint, components: bigint[]) {
  const fundingMinor = customer + funding - gross;
  const beneficiaryMinor = gross - net - fee;
  const feeMinor = fee - components.reduce((sum, value) => sum + value, 0n);
  const absolute = (value: bigint) => value < 0n ? -value : value;
  const feeLimit = BigInt(Math.max(0, components.length - 1));
  if (absolute(fundingMinor) > 1n || absolute(beneficiaryMinor) > 1n || absolute(feeMinor) > feeLimit) {
    throw new Error('Refund difference exceeds cumulative rounding bounds');
  }
  return { fundingMinor: fundingMinor.toString(), beneficiaryMinor: beneficiaryMinor.toString(),
    feeMinor: feeMinor.toString(), platformMinor: (fundingMinor + beneficiaryMinor + feeMinor).toString() };
}

/** Pure prospective plan. History must come from successful, immutable refunds,
 * under the capture lock. No caller-supplied amounts, current rates or FX.
 * Non-item refunds require a separately authorized shipping/gift-wrap contract.
 */
export function planQuantityRefund(quote: EconomicQuote, selection: RefundSelection[],
  previous: ReadonlyMap<string, number> = new Map(), giftWrapApproval?: GiftWrapRefundApproval,
  shippingEligibility?: ShippingRefundEligibility): EconomicRefundPlan {
  const quoteHash = quoteFingerprint(quote);
  if (!selection.length || selection.length > 100) throw new Error('Select 1–100 refund lines');
  if (exactMinor(quote.tax.amountMinor) !== 0n) throw new Error('Tax-bearing refunds require verified tax allocation');
  const seen = new Set<string>();
  const shipping = selection.map(row => quote.parts.find(part => part.key === row.partKey))
    .filter((part): part is EconomicQuote['parts'][number] => part?.kind === 'SHIPPING');
  if (shipping.length || shippingEligibility) {
    const ids = [...new Set(shipping.map(part => part.storeOrderId))].sort();
    if (!shippingEligibility || shippingEligibility.policy !== SHIPPING_REFUND_POLICY || !ids.length
      || canonicalEconomicJson(ids) !== canonicalEconomicJson(shippingEligibility.storeOrderIds)
      || canonicalEconomicJson(shippingEligibility.previousItemQuantities) !== canonicalEconomicJson(Object.fromEntries(
        quote.parts.filter(part => part.kind === 'ITEM' && ids.includes(part.storeOrderId))
          .map(part => [part.key, previous.get(part.key) ?? 0])))) {
      throw new Error('Shipping refund requires server-verified full-shop pre-handoff eligibility');
    }
    for (const id of ids) {
      const items = quote.parts.filter(part => part.storeOrderId === id && part.kind === 'ITEM');
      if (!items.length || items.some(part => (previous.get(part.key) ?? 0)
        + (selection.find(row => row.partKey === part.key)?.quantity ?? 0) !== part.quantity)) {
        throw new Error('Shipping refund requires every original shop item to be refunded');
      }
    }
  }
  if (giftWrapApproval && (giftWrapApproval.policy !== GIFT_WRAP_REFUND_POLICY
    || !giftWrapApproval.approvedBy.trim() || giftWrapApproval.approvedBy !== giftWrapApproval.approvedBy.trim()
    || !giftWrapApproval.reason.trim() || giftWrapApproval.reason !== giftWrapApproval.reason.trim()
    || giftWrapApproval.reason.length > 500 || giftWrapApproval.approvedBy.length > 150
    || !selection.some(row => quote.parts.find(part => part.key === row.partKey)?.kind === 'GIFT_WRAP'))) {
    throw new Error('Explicit gift wrap approval requires the original gift wrap allocation, actor and reason');
  }
  for (const [key, units] of previous) {
    const original = quote.parts.find(p => p.key === key);
    if (!original || !Number.isSafeInteger(units) || units < 0 || units > original.quantity) {
      throw new Error('Invalid original refund history');
    }
  }
  // Fix the commission split by original merchandise funding, never refund order.
  const affiliateByPart = new Map(allocateMinorUnits(exactMinor(quote.affiliate?.commissionMinor ?? '0'),
    quote.parts.filter(p => p.kind === 'ITEM').map(p => ({ id: p.key, weight: exactMinor(p.sellerGrossMinor) })))
    .map(p => [p.id, p.amount]));
  const parts = [...selection].sort((a, b) => a.partKey < b.partKey ? -1 : a.partKey > b.partKey ? 1 : 0).map(selected => {
    if (seen.has(selected.partKey)) throw new Error('Duplicate refund line');
    seen.add(selected.partKey);
    const part = quote.parts.find(p => p.key === selected.partKey);
    if (!part || (part.kind !== 'ITEM' && !(part.kind === 'GIFT_WRAP' && giftWrapApproval)
      && !(part.kind === 'SHIPPING' && shippingEligibility?.storeOrderIds.includes(part.storeOrderId)))) {
      throw new Error('Refund line is not original merchandise or explicitly approved gift wrap/eligible shipping');
    }
    const previousQuantity = previous.get(part.key) ?? 0;
    const delta = (amount: string) => refundByQuantity(exactMinor(amount), part.quantity, previousQuantity, selected.quantity);
    const customer = delta(part.customerMinor), funding = delta(part.platformFundingMinor);
    const gross = delta(part.sellerGrossMinor), net = delta(part.sellerNetMinor);
    const fee = delta(part.sellerFeeMinor);
    const fees = part.fees.map(f => ({ ...f, amountMinor: delta(f.amountMinor).toString() }));
    const rounding = platformRounding(customer, funding, gross, net, fee, fees.map(f => exactMinor(f.amountMinor)));
    return { partKey: part.key, storeId: part.storeId, storeOrderId: part.storeOrderId, lineId: part.lineId,
      quantity: selected.quantity, previousQuantity, customerMinor: customer.toString(), platformFundingMinor: funding.toString(),
      sellerGrossMinor: gross.toString(), sellerFeeMinor: fee.toString(), sellerNetMinor: net.toString(), fees, rounding,
      affiliateMinor: refundByQuantity(affiliateByPart.get(part.key) ?? 0n, part.quantity, previousQuantity, selected.quantity).toString() };
  });
  const customer = parts.reduce((sum, p) => sum + exactMinor(p.customerMinor), 0n);
  if (customer <= 0n || customer > exactMinor(quote.customerTotalMinor)) throw new Error('Refund requires a positive captured customer amount');
  return { version: 'refund-v1', quoteHash, currency: quote.currency, minorExponent: quote.minorExponent, parts,
    customerMinor: customer.toString(), affiliateMinor: parts.reduce((sum, p) => sum + exactMinor(p.affiliateMinor), 0n).toString(),
    roundingPolicy: REFUND_ROUNDING_POLICY,
    ...(giftWrapApproval ? { giftWrapApproval } : {}),
    ...(shippingEligibility ? { shippingEligibility } : {}),
    platformRoundingMinor: parts.reduce((sum, p) => sum + exactSignedMinor(p.rounding.platformMinor), 0n).toString() };
}

export function refundRequestHash(input: { captureId: string; actorId: string; reason: string; selection: RefundSelection[]; approveGiftWrap?: boolean }) {
  for (const value of [input.captureId, input.actorId, input.reason]) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 500) throw new Error('Refund audit identity is required');
  }
  return createHash('sha256').update(canonicalEconomicJson({ captureId: input.captureId, actorId: input.actorId, reason: input.reason,
    ...(input.approveGiftWrap === true ? { approveGiftWrap: true } : {}),
    selection: [...input.selection].sort((a, b) => a.partKey < b.partKey ? -1 : a.partKey > b.partKey ? 1 : 0),
  })).digest('hex');
}

/** The paid payout is never rewritten. Reserved transfers have an uncertain
 * external outcome and must be resolved before planning a debit of this lot.
 * Pure arithmetic only; persistence/ledger booking is a separate transaction.
 */
export function refundLotImpact(input: {
  amount: bigint; paid: bigint; reserved: bigint; previouslyReversed: bigint; reversal: bigint;
}) {
  const { amount, paid, reserved, previouslyReversed, reversal } = input;
  for (const value of Object.values(input)) exactMinor(value.toString());
  if (paid + reserved > amount || previouslyReversed > amount || reversal > amount - previouslyReversed) {
    throw new Error('Refund exceeds original beneficiary allocation');
  }
  if (reserved > 0n) throw new Error('Resolve reserved payout before refund settlement');
  const reversed = previouslyReversed + reversal;
  const previousDebt = paid + previouslyReversed > amount ? paid + previouslyReversed - amount : 0n;
  const totalDebt = paid + reversed > amount ? paid + reversed - amount : 0n;
  const debt = totalDebt - previousDebt;
  return { reversed, availableDebit: reversal - debt, debt, paidUnchanged: paid };
}
