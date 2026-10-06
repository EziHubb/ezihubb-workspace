import { EconomicJournalAccount } from '@prisma/client';
import { EconomicQuote, exactMinor, quoteFingerprint } from './economic-quote';

export type CaptureJournalRow = {
  entryKey: string; account: EconomicJournalAccount; beneficiaryId: string | null;
  currency: string; amountMinor: bigint;
};

export function captureJournal(quote: EconomicQuote): CaptureJournalRow[] {
  quoteFingerprint(quote);
  const rows: CaptureJournalRow[] = [];
  const add = (entryKey: string, account: EconomicJournalAccount, amountMinor: bigint, beneficiaryId: string | null = null) => {
    if (amountMinor !== 0n) rows.push({ entryKey, account, amountMinor, beneficiaryId, currency: quote.currency });
  };
  add('customer-capture', 'CUSTOMER_FUNDS', exactMinor(quote.customerTotalMinor));
  add('customer-tax', 'TAX_PAYABLE', -exactMinor(quote.tax.amountMinor));
  for (const part of quote.parts) {
    add(`${part.key}:funding`, 'PLATFORM_PROMOTION', exactMinor(part.platformFundingMinor));
    add(`${part.key}:seller-gross`, 'SELLER_PAYABLE', -exactMinor(part.sellerGrossMinor), part.storeId);
    add(`${part.key}:seller-fee`, 'SELLER_PAYABLE', exactMinor(part.sellerFeeMinor), part.storeId);
    const feeTax = part.fees.filter(fee => fee.code === 'VAT').reduce((sum, fee) => sum + exactMinor(fee.amountMinor), 0n);
    add(`${part.key}:fee-tax`, 'TAX_PAYABLE', -feeTax);
    add(`${part.key}:fee-revenue`, 'PLATFORM_FEES', -(exactMinor(part.sellerFeeMinor) - feeTax));
  }
  if (quote.affiliate) {
    add('affiliate-cost', 'PLATFORM_AFFILIATE_COST', exactMinor(quote.affiliate.commissionMinor));
    add('affiliate-pending', 'AFFILIATE_PENDING', -exactMinor(quote.affiliate.commissionMinor), quote.affiliate.id);
  }
  if (rows.reduce((sum, row) => sum + row.amountMinor, 0n) !== 0n) throw new Error('Unbalanced capture journal');
  return rows;
}
