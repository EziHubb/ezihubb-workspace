import { EconomicJournalAccount } from '@prisma/client';
import { canonicalEconomicJson, EconomicQuote, exactMinor } from './economic-quote';
import { EconomicRefundPlan, exactSignedMinor, planQuantityRefund, planShippingOverride } from './economic-refund-plan';

export type RefundJournalRow = {
  entryKey: string; account: EconomicJournalAccount | 'PLATFORM_ROUNDING'; beneficiaryId: string | null;
  currency: string; amountMinor: string;
};

/** Immutable planned reversal, not a booked refund or expense. Successful
 * provider evidence is required before a settlement consumer may book it.
 * Recompute from original quote before trusting any signed adjustment.
 */
export function plannedRefundJournal(plan: EconomicRefundPlan, quote: EconomicQuote): RefundJournalRow[] {
  const approval = plan.shippingOverrideApproval;
  if (plan.version === 'shipping-override-v1' && !approval) throw new Error('Shipping exception approval is required');
  const expected = plan.version === 'shipping-override-v1' && approval ? planShippingOverride(quote,
    { partKey: approval.partKey, amountMinor: approval.amountMinor, evidenceReference: approval.evidenceReference },
    approval.previousCustomerMinor, approval.approvedBy, approval.reason)
    : planQuantityRefund(quote, plan.parts.map(part => ({ partKey: part.partKey, quantity: part.quantity })),
    new Map([...Object.entries(plan.shippingEligibility?.previousItemQuantities ?? {}),
      ...plan.parts.map(part => [part.partKey, part.previousQuantity] as [string, number])]), plan.giftWrapApproval, plan.shippingEligibility);
  if (canonicalEconomicJson(plan) !== canonicalEconomicJson(expected)) throw new Error('Refund plan differs from original allocation');
  const rows: RefundJournalRow[] = [];
  const add = (entryKey: string, account: RefundJournalRow['account'], amount: bigint, beneficiaryId: string | null = null) => {
    if (amount !== 0n) rows.push({ entryKey, account, beneficiaryId, currency: quote.currency, amountMinor: amount.toString() });
  };
  add('customer-refund', 'CUSTOMER_FUNDS', -exactMinor(plan.customerMinor));
  for (const part of plan.parts) {
    add(`${part.partKey}:funding`, 'PLATFORM_PROMOTION', -exactMinor(part.platformFundingMinor));
    add(`${part.partKey}:seller-net`, 'SELLER_PAYABLE', exactMinor(part.sellerNetMinor), part.storeId);
    const feeTax = part.fees.filter(fee => fee.code === 'VAT').reduce((sum, fee) => sum + exactMinor(fee.amountMinor), 0n);
    const feeTotal = part.fees.reduce((sum, fee) => sum + exactMinor(fee.amountMinor), 0n);
    add(`${part.partKey}:fee-tax`, 'TAX_PAYABLE', feeTax);
    add(`${part.partKey}:fee-revenue`, 'PLATFORM_FEES', feeTotal - feeTax);
    add(`${part.partKey}:platform-rounding`, 'PLATFORM_ROUNDING', exactSignedMinor(part.rounding.platformMinor));
  }
  if (quote.affiliate) {
    add('affiliate-cost', 'PLATFORM_AFFILIATE_COST', -exactMinor(plan.affiliateMinor));
    add('affiliate-pending', 'AFFILIATE_PENDING', exactMinor(plan.affiliateMinor), quote.affiliate.id);
  }
  if (rows.reduce((sum, row) => sum + exactSignedMinor(row.amountMinor), 0n) !== 0n) throw new Error('Unbalanced refund journal');
  return rows;
}
