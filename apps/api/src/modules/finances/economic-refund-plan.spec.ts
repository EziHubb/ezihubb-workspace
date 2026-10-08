import { buildEconomicQuote, QuoteInput } from './economic-quote';
import { exactSignedMinor, GIFT_WRAP_REFUND_POLICY, planQuantityRefund, planShippingOverride, refundLotImpact, refundRequestHash } from './economic-refund-plan';
import { plannedRefundJournal } from './economic-refund-journal';

function fixture(): QuoteInput {
  return { orderId: 'order', currency: 'USD', minorExponent: 2,
    stores: ['A', 'B'].map(id => ({ storeId: id, storeOrderId: `shop${id}`,
      lines: [{ id, productId: `product${id}`, variantId: null, quantity: 3, unitPriceMinor: '100',
        sellerDiscountMinor: '0', platformDiscountMinor: '0' }], customerShippingMinor: '0',
      expectedShippingSubsidyMinor: '500', giftWrapMinor: '0', fees: [] })),
    tax: { amountMinor: '0', ruleReference: 'test-rule' },
    affiliate: { id: 'affiliate', commissionMinor: '200', rate: '0.1', lockDays: 14, ruleReference: 'test-rule' } };
}

describe('M4 original-allocation refund planning', () => {
  it('allocates sequential shipping exceptions from original money and reverses every original component exactly', () => {
    const input = fixture(); input.stores[0].customerShippingMinor = '503';
    input.stores[0].fees = [{ code: 'TRANSACTION_FEE', amountMinor: '31', ruleReference: 'original' },
      { code: 'VAT', amountMinor: '9', ruleReference: 'original-tax' }];
    const quote = buildEconomicQuote(input), original = quote.parts.find(row => row.kind === 'SHIPPING' && row.storeId === 'A');
    if (!original) throw new Error('Synthetic shipping allocation missing');
    let previous = 0n;
    const plans = ['1', '201', '301'].map(amountMinor => {
      const plan = planShippingOverride(quote, { partKey: original.key, amountMinor, evidenceReference: 'support-case-1' }, previous.toString(), 'operator', 'Approved exception');
      previous += BigInt(amountMinor);
      expect(plannedRefundJournal(plan, quote).reduce((sum, row) => sum + BigInt(row.amountMinor), 0n)).toBe(0n);
      expect(plan.shippingOverrideApproval).toMatchObject({ approvedBy: 'operator', evidenceReference: 'support-case-1' });
      return plan;
    });
    for (const field of ['customerMinor', 'platformFundingMinor', 'sellerGrossMinor', 'sellerFeeMinor', 'sellerNetMinor'] as const) {
      expect(plans.reduce((sum, plan) => sum + BigInt(plan.parts[0][field]), 0n)).toBe(BigInt(original[field]));
    }
    original.fees.forEach((fee, index) => expect(plans.reduce((sum, plan) => sum + BigInt(plan.parts[0].fees[index].amountMinor), 0n)).toBe(BigInt(fee.amountMinor)));
    expect(plans.reduce((sum, plan) => sum + BigInt(plan.platformRoundingMinor), 0n)).toBe(0n);
  });
  it('rejects shipping exceptions with excess/zero/subsidy-only money, nonshipping parts or missing audit', () => {
    const input = fixture(); input.stores[0].customerShippingMinor = '500';
    const quote = buildEconomicQuote(input), base = { partKey: 'shipping:shopA', amountMinor: '1', evidenceReference: 'case' };
    for (const amountMinor of ['0', '-1', '501', '01', '1.5', '9223372036854775808']) {
      expect(() => planShippingOverride(quote, { ...base, amountMinor }, '0', 'operator', 'Approved')).toThrow();
    }
    expect(() => planShippingOverride(quote, base, '500', 'operator', 'Approved')).toThrow();
    for (const partKey of ['item:A', 'shipping:shopB', 'foreign']) expect(() => planShippingOverride(quote, { ...base, partKey }, '0', 'operator', 'Approved')).toThrow();
    expect(() => planShippingOverride(quote, { ...base, evidenceReference: ' ' }, '0', 'operator', 'Approved')).toThrow();
    expect(() => planShippingOverride(quote, base, '0', ' ', 'Approved')).toThrow();
    expect(() => planShippingOverride(quote, base, '0', 'operator', ' ')).toThrow();
    input.tax.amountMinor = '1';
    expect(() => planShippingOverride(buildEconomicQuote(input), base, '0', 'operator', 'Approved')).toThrow('tax allocation');
  });
  it('keeps shipping exception money above Number precision exact', () => {
    const input = fixture(); input.stores[0].customerShippingMinor = '9007199254740993';
    const plan = planShippingOverride(buildEconomicQuote(input), { partKey: 'shipping:shopA', amountMinor: '9007199254740993', evidenceReference: 'case' }, '0', 'operator', 'Approved');
    expect(plan.customerMinor).toBe('9007199254740993');
    expect(plan.parts[0].sellerNetMinor).toBe('9007199254740993');
  });
  it('isolates shops, excludes expected shipping subsidy and conserves commission residuals', () => {
    const quote = buildEconomicQuote(fixture());
    const previous = new Map<string, number>();
    const plans = [0, 1, 2].map(units => {
      previous.set('item:A', units);
      return planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }], previous);
    });
    expect(plans.map(p => p.customerMinor)).toEqual(['100', '100', '100']);
    expect(plans.map(p => p.affiliateMinor)).toEqual(['33', '33', '34']);
    expect(plans.every(p => p.parts.length === 1 && p.parts[0].storeId === 'A')).toBe(true);
  });

  it('returns the original fees and funding, not rates from mutable settings', () => {
    const input = fixture();
    input.stores[0].lines[0].platformDiscountMinor = '30';
    input.stores[0].fees = [{ code: 'TRANSACTION_FEE', amountMinor: '30', ruleReference: 'old-policy' }];
    const plan = planQuantityRefund(buildEconomicQuote(input), [{ partKey: 'item:A', quantity: 1 }]);
    expect(plan.parts[0]).toMatchObject({ customerMinor: '90', platformFundingMinor: '10',
      sellerGrossMinor: '100', sellerFeeMinor: '10', sellerNetMinor: '90',
      fees: [{ code: 'TRANSACTION_FEE', amountMinor: '10', ruleReference: 'old-policy' }] });
  });

  it.each([0, -1, 4, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid quantity %s', quantity => {
    expect(() => planQuantityRefund(buildEconomicQuote(fixture()), [{ partKey: 'item:A', quantity }])).toThrow();
  });

  it('rejects unknown/repeated lines and cumulative over-refunds', () => {
    const quote = buildEconomicQuote(fixture());
    expect(() => planQuantityRefund(quote, [])).toThrow();
    expect(() => planQuantityRefund(quote, [{ partKey: 'other', quantity: 1 }])).toThrow();
    expect(() => planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }, { partKey: 'item:A', quantity: 1 }])).toThrow();
    expect(() => planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }], new Map([['item:A', 3]]))).toThrow();
    expect(() => planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }], new Map([['foreign', 1]]))).toThrow();
  });

  it('fails closed for unsupported tax and shipping without verified eligibility', () => {
    const input = fixture(); input.tax.amountMinor = '10';
    expect(() => planQuantityRefund(buildEconomicQuote(input), [{ partKey: 'item:A', quantity: 1 }])).toThrow('tax allocation');
    input.tax.amountMinor = '0'; input.stores[0].customerShippingMinor = '500';
    expect(() => planQuantityRefund(buildEconomicQuote(input), [{ partKey: 'shipping:shopA', quantity: 1 }])).toThrow('server-verified');
  });
  it('never automatically refunds gift wrap and only uses the explicitly approved original allocation', () => {
    const input = fixture(); input.stores[0].giftWrapMinor = '45';
    const quote = buildEconomicQuote(input), selection = [{ partKey: 'gift-wrap:shopA', quantity: 1 }];
    expect(() => planQuantityRefund(quote, selection)).toThrow('explicitly approved');
    const approval = { policy: GIFT_WRAP_REFUND_POLICY, approvedBy: 'operator', reason: 'Separate gift wrap approval' } as const;
    const plan = planQuantityRefund(quote, selection, new Map(), approval);
    expect(plan).toMatchObject({ customerMinor: '45', affiliateMinor: '0', giftWrapApproval: approval,
      parts: [{ storeId: 'A', storeOrderId: 'shopA', quantity: 1, previousQuantity: 0 }] });
    expect(plannedRefundJournal(plan, quote).reduce((sum, row) => sum + BigInt(row.amountMinor), 0n)).toBe(0n);
    expect(() => planQuantityRefund(quote, selection, new Map([['gift-wrap:shopA', 1]]), approval)).toThrow();
    expect(() => planQuantityRefund(quote, [{ partKey: 'gift-wrap:shopA', quantity: 2 }], new Map(), approval)).toThrow();
    expect(() => planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }], new Map(), approval)).toThrow('original gift wrap');
    expect(planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }]).giftWrapApproval).toBeUndefined();
  });
  it('binds explicit gift wrap approval to idempotency without changing existing merchandise request hashes', () => {
    const input = { captureId: 'capture', actorId: 'operator', reason: 'Return', selection: [{ partKey: 'item:A', quantity: 1 }] };
    expect(refundRequestHash(input)).toBe(refundRequestHash({ ...input, approveGiftWrap: false }));
    expect(refundRequestHash(input)).not.toBe(refundRequestHash({ ...input, approveGiftWrap: true }));
  });

  it('records funding rounding separately and preserves the full original customer amount', () => {
    const input = fixture();
    input.stores[0].lines[0].platformDiscountMinor = '1';
    const quote = buildEconomicQuote(input);
    const plans = [0, 1, 2].map(previous => planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }], new Map([['item:A', previous]])));
    expect(plans.map(plan => plan.customerMinor)).toEqual(['99', '100', '100']);
    expect(plans.map(plan => plan.platformRoundingMinor)).toEqual(['-1', '0', '1']);
    expect(plans.reduce((sum, plan) => sum + BigInt(plan.customerMinor), 0n)).toBe(299n);
    expect(plans.reduce((sum, plan) => sum + exactSignedMinor(plan.platformRoundingMinor), 0n)).toBe(0n);
    for (const plan of plans) expect(plannedRefundJournal(plan, quote).reduce((sum, row) => sum + BigInt(row.amountMinor), 0n)).toBe(0n);
  });

  it('keeps VAT and each fee original while planning positive and negative platform adjustments', () => {
    const input = fixture(); input.affiliate = null;
    input.stores[0].fees = [{ code: 'TRANSACTION_FEE', amountMinor: '1', ruleReference: 'old-fee' },
      { code: 'VAT', amountMinor: '1', ruleReference: 'old-vat' }];
    const quote = buildEconomicQuote(input);
    const plans = [0, 1, 2].map(previous => planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }], new Map([['item:A', previous]])));
    expect(plans.map(plan => plan.parts[0].sellerNetMinor)).toEqual(['99', '99', '100']);
    expect(plans.map(plan => plan.platformRoundingMinor)).toEqual(['1', '1', '-2']);
    const entries = plans.flatMap(plan => plannedRefundJournal(plan, quote));
    const byAccount = (account: string) => entries.filter(entry => entry.account === account).reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n);
    expect(byAccount('SELLER_PAYABLE')).toBe(298n);
    expect(byAccount('TAX_PAYABLE')).toBe(1n);
    expect(byAccount('PLATFORM_FEES')).toBe(1n);
    expect(byAccount('CUSTOMER_FUNDS')).toBe(-300n);
    expect(byAccount('PLATFORM_ROUNDING')).toBe(0n);
    for (const plan of plans) expect(plannedRefundJournal(plan, quote).reduce((sum, row) => sum + BigInt(row.amountMinor), 0n)).toBe(0n);
  });

  it('conserves every component across refund groupings, quantities and shop order', () => {
    for (const quantity of [2, 3, 5, 7]) {
      for (const discount of ['0', '1', '3', '11']) {
        const input = fixture(); input.stores[0].lines[0].quantity = quantity;
        input.stores[0].lines[0].platformDiscountMinor = discount;
        input.stores[0].fees = [{ code: 'TRANSACTION_FEE', amountMinor: '7', ruleReference: 'original' },
          { code: 'VAT', amountMinor: '3', ruleReference: 'original' }];
        const quote = buildEconomicQuote(input), original = quote.parts.find(part => part.key === 'item:A');
        if (!original) throw new Error('Missing fixture part');
        for (const group of [1, 2, quantity]) {
          const plans = [];
          for (let units = 0; units < quantity; units += group) {
            const plan = planQuantityRefund(quote, [{ partKey: 'item:A', quantity: Math.min(group, quantity - units) }], new Map([['item:A', units]]));
            expect(plannedRefundJournal(plan, quote).reduce((sum, row) => sum + BigInt(row.amountMinor), 0n)).toBe(0n);
            plans.push(plan);
          }
          for (const field of ['customerMinor', 'platformFundingMinor', 'sellerGrossMinor', 'sellerFeeMinor', 'sellerNetMinor'] as const) {
            expect(plans.reduce((sum, plan) => sum + BigInt(plan.parts[0][field]), 0n)).toBe(BigInt(original[field]));
          }
          expect(plans.reduce((sum, plan) => sum + BigInt(plan.platformRoundingMinor), 0n)).toBe(0n);
          expect(plans.reduce((sum, plan) => sum + BigInt(plan.affiliateMinor), 0n))
            .toBe(BigInt(planQuantityRefund(quote, [{ partKey: 'item:A', quantity }]).affiliateMinor));
        }
        const selection = [{ partKey: 'item:B', quantity: 1 }, { partKey: 'item:A', quantity: 1 }];
        expect(planQuantityRefund(quote, selection)).toEqual(planQuantityRefund(quote, [...selection].reverse()));
      }
    }
  });

  it('rejects invented rounding, changed fees and offsetting fake allocations before constructing the journal', () => {
    const quote = buildEconomicQuote(fixture());
    const plan = planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 1 }]);
    for (const mutate of [
      (copy: typeof plan) => { copy.platformRoundingMinor = '100'; copy.parts[0].rounding.platformMinor = '100'; },
      (copy: typeof plan) => { copy.parts[0].customerMinor = '101'; copy.parts[0].sellerNetMinor = '101'; },
      (copy: typeof plan) => { copy.parts[0].rounding.fundingMinor = '1'; copy.parts[0].rounding.beneficiaryMinor = '-1'; },
      (copy: typeof plan) => { copy.parts[0].fees = [{ code: 'VAT', amountMinor: '0', ruleReference: 'invented' }]; },
    ]) {
      const copy = structuredClone(plan); mutate(copy);
      expect(() => plannedRefundJournal(copy, quote)).toThrow('original allocation');
    }
    for (const value of ['-0', '1.1', '01', '+1', 'NaN', '-9223372036854775808']) expect(() => exactSignedMinor(value)).toThrow();
  });

  it('never converts high-value refund amounts to floating point', () => {
    const input = fixture(); input.affiliate = null;
    input.stores[0].lines[0].unitPriceMinor = '9007199254740993';
    input.stores[0].lines[0].platformDiscountMinor = '1';
    const quote = buildEconomicQuote(input);
    const plan = planQuantityRefund(quote, [{ partKey: 'item:A', quantity: 3 }]);
    expect(plan.customerMinor).toBe('27021597764222978');
    expect(plan.platformRoundingMinor).toBe('0');
    expect(plannedRefundJournal(plan, quote).reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n)).toBe(0n);
  });

  it('makes request identity order-independent, but binds actor, reason and amounts', () => {
    const request = { captureId: 'capture', actorId: 'actor', reason: 'Returned',
      selection: [{ partKey: 'item:B', quantity: 1 }, { partKey: 'item:A', quantity: 2 }] };
    expect(refundRequestHash(request)).toBe(refundRequestHash({ ...request, selection: [...request.selection].reverse() }));
    expect(refundRequestHash(request)).not.toBe(refundRequestHash({ ...request, actorId: 'other' }));
    expect(() => refundRequestHash({ ...request, reason: ' ' })).toThrow();
  });

  it('preserves paid evidence and creates only the additional post-payout debt', () => {
    expect(refundLotImpact({ amount: 100n, paid: 60n, reserved: 0n, previouslyReversed: 0n, reversal: 70n }))
      .toEqual({ reversed: 70n, availableDebit: 40n, debt: 30n, paidUnchanged: 60n });
    expect(refundLotImpact({ amount: 100n, paid: 60n, reserved: 0n, previouslyReversed: 70n, reversal: 30n }))
      .toEqual({ reversed: 100n, availableDebit: 0n, debt: 30n, paidUnchanged: 60n });
  });

  it('blocks unresolved payout reservations and excessive reversals', () => {
    expect(() => refundLotImpact({ amount: 100n, paid: 0n, reserved: 1n, previouslyReversed: 0n, reversal: 1n })).toThrow('reserved payout');
    expect(() => refundLotImpact({ amount: 100n, paid: 0n, reserved: 0n, previouslyReversed: 99n, reversal: 2n })).toThrow('exceeds');
  });
});
