import { buildEconomicQuote, canonicalEconomicJson, EconomicQuote, QuoteInput, quoteFingerprint } from './economic-quote';
import { captureJournal } from './economic-journal';

export function quoteFixture(): QuoteInput {
  return {
    orderId: 'order1', currency: 'USD', minorExponent: 2,
    stores: [
      { storeId: 'storeA', storeOrderId: 'shopOrderA', lines: [
        { id: 'lineA', productId: 'productA', variantId: null, quantity: 2,
          unitPriceMinor: '2249', sellerDiscountMinor: '498', platformDiscountMinor: '500' },
      ], customerShippingMinor: '0', expectedShippingSubsidyMinor: '500', giftWrapMinor: '0',
      fees: [{ code: 'TRANSACTION_FEE', amountMinor: '260', ruleReference: 'settings-v1' }] },
      { storeId: 'storeB', storeOrderId: 'shopOrderB', lines: [
        { id: 'lineB', productId: 'productB', variantId: 'variantB', quantity: 3,
          unitPriceMinor: '3000', sellerDiscountMinor: '0', platformDiscountMinor: '501' },
      ], customerShippingMinor: '0', expectedShippingSubsidyMinor: '750', giftWrapMinor: '0',
      fees: [{ code: 'TRANSACTION_FEE', amountMinor: '585', ruleReference: 'settings-v1' }] },
    ], tax: { amountMinor: '0', ruleReference: 'synthetic-tax-rule' }, affiliate: null,
  };
}

describe('immutable prospective quote and balanced capture journal', () => {
  it('conserves customer funds and explicit subsidy without inventing shipping revenue', () => {
    const quote = buildEconomicQuote(quoteFixture());
    expect(quote).toMatchObject({ customerTotalMinor: '11999', platformFundingMinor: '1001',
      sellerGrossMinor: '13000', sellerFeeMinor: '845', sellerNetMinor: '12155',
      expectedShippingSubsidyMinor: '1250', providerCost: 'UNRECONCILED' });
    expect(quote.parts).toHaveLength(2);
    const journal = captureJournal(quote);
    expect(journal.reduce((sum, row) => sum + row.amountMinor, 0n)).toBe(0n);
    expect(journal.filter(row => row.account === 'CUSTOMER_FUNDS')[0].amountMinor).toBe(11999n);
    expect(journal.filter(row => row.account === 'SELLER_PAYABLE').reduce((sum, row) => sum - row.amountMinor, 0n)).toBe(12155n);
  });

  it('separates customer shipping, gift wrap, tax, fee VAT and pending affiliate liability', () => {
    const input = quoteFixture();
    input.stores[0].customerShippingMinor = '500';
    input.stores[0].expectedShippingSubsidyMinor = '0';
    input.stores[0].giftWrapMinor = '200';
    input.stores[0].fees.push({ code: 'VAT', amountMinor: '26', ruleReference: 'verified-fee-tax-rule' });
    input.tax.amountMinor = '300';
    input.affiliate = { id: 'affiliate1', commissionMinor: '1000', rate: '0.1', lockDays: 14, ruleReference: 'affiliate-v1' };
    const quote = buildEconomicQuote(input);
    expect(quote.customerTotalMinor).toBe('12999');
    expect(quote.parts.filter(part => part.kind !== 'ITEM').map(part => part.kind).sort()).toEqual(['GIFT_WRAP', 'SHIPPING']);
    const journal = captureJournal(quote);
    expect(journal.reduce((sum, row) => sum + row.amountMinor, 0n)).toBe(0n);
    expect(journal.filter(row => row.account === 'TAX_PAYABLE').reduce((sum, row) => sum - row.amountMinor, 0n)).toBe(326n);
    expect(journal.find(row => row.account === 'AFFILIATE_PENDING')).toMatchObject({ amountMinor: -1000n, beneficiaryId: 'affiliate1' });
    expect(journal.filter(row => row.account === 'PLATFORM_FEES').reduce((sum, row) => sum - row.amountMinor, 0n)).toBe(845n);
  });

  it('hashes deterministically after input permutations and JSONB object-key reordering', () => {
    const input = quoteFixture();
    const quote = buildEconomicQuote(input);
    input.stores.reverse();
    expect(quoteFingerprint(buildEconomicQuote(input))).toBe(quoteFingerprint(quote));
    const reordered = JSON.parse(canonicalEconomicJson(quote)) as EconomicQuote;
    expect(quoteFingerprint(reordered)).toBe(quoteFingerprint(quote));
    quote.parts[0].sellerNetMinor = '999';
    expect(() => quoteFingerprint(quote)).toThrow('not canonical');
  });

  it('does not allow multiple fee remainders to overdraw a one-cent line', () => {
    const input = quoteFixture();
    input.stores = [{ ...input.stores[0], lines: ['a', 'b'].map(id => ({
      id, productId: id, variantId: null, quantity: 1, unitPriceMinor: '1', sellerDiscountMinor: '0', platformDiscountMinor: '0',
    })), fees: ['TRANSACTION_FEE', 'VAT'].map(code => ({ code, amountMinor: '1', ruleReference: 'tiny-fee-fixture' })) }];
    const quote = buildEconomicQuote(input);
    expect(quote.sellerFeeMinor).toBe('2');
    expect(quote.parts.map(part => part.sellerNetMinor)).toEqual(['0', '0']);
    expect(captureJournal(quote).reduce((sum, row) => sum + row.amountMinor, 0n)).toBe(0n);
  });

  it('rejects negative/floating/overflow money, missing tax evidence and duplicate identities', () => {
    for (const value of ['-1', '1.1', '1e2', '9223372036854775808']) {
      const input = quoteFixture(); input.stores[0].lines[0].unitPriceMinor = value;
      expect(() => buildEconomicQuote(input)).toThrow();
    }
    const missingTax = quoteFixture(); missingTax.tax.ruleReference = '';
    expect(() => buildEconomicQuote(missingTax)).toThrow();
    const duplicate = quoteFixture(); duplicate.stores[1].lines[0].id = duplicate.stores[0].lines[0].id;
    expect(() => buildEconomicQuote(duplicate)).toThrow();
    const excessiveFee = quoteFixture(); excessiveFee.stores[0].fees[0].amountMinor = '100000';
    expect(() => buildEconomicQuote(excessiveFee)).toThrow('Fees exceed');
  });

  it.each(['LISTING_FEE', 'OFFSITE_ADS_FEE', 'SHARE_SAVE_REFUND'])('rejects %s without its separate evidence contract', code => {
    const input = quoteFixture(); input.stores[0].fees[0].code = code;
    expect(() => buildEconomicQuote(input)).toThrow('Unsupported');
  });

  it('strips unexpected PII from quote inputs and retains exact unit/discount sources', () => {
    const input = { ...quoteFixture(), email: 'not-for-financial-snapshot' };
    const quote = buildEconomicQuote(input);
    expect(JSON.stringify(quote)).not.toContain('not-for-financial-snapshot');
    expect(quote.stores[0].lines[0]).toMatchObject({ unitPriceMinor: '2249', quantity: 2, sellerDiscountMinor: '498' });
  });
});
