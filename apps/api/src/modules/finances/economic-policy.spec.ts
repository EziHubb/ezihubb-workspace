import {
  allocateMinorUnits, parseMinorUnits, quoteFunding, refundByQuantity, shippingRefund,
} from './economic-policy';

describe('approved economic policy v1 (pure, not provider evidence)', () => {
  it('parses money exactly above the JS safe integer boundary', () => {
    expect(parseMinorUnits('9007199254740993.99', 2)).toBe(900719925474099399n);
    expect(parseMinorUnits('125', 0)).toBe(125n);
    expect(parseMinorUnits('1.005', 3)).toBe(1005n);
    expect(parseMinorUnits('1.5', 2)).toBe(150n);
  });

  it.each(['-1', '1e2', 'NaN', ' 1', '01', '1.001', '1.', '+1'])('rejects inexact/invalid amount %s', (amount) => {
    expect(() => parseMinorUnits(amount, 2)).toThrow();
  });

  it('rejects unsupported exponents and fractional zero-decimal money', () => {
    for (const exponent of [-1, 1.5, 4, NaN]) {
      expect(() => parseMinorUnits('1', exponent)).toThrow();
    }
    expect(() => parseMinorUnits('1.0', 0)).toThrow();
  });

  it('allocates residual cents deterministically across shops regardless of input order', () => {
    const rows = [{ id: 'B', weight: 1n }, { id: 'A', weight: 1n }, { id: 'C', weight: 1n }];
    expect(allocateMinorUnits(100n, rows)).toEqual([
      { id: 'B', amount: 33n }, { id: 'A', amount: 34n }, { id: 'C', amount: 33n },
    ]);
    expect(new Map(allocateMinorUnits(100n, [...rows].reverse()).map(r => [r.id, r.amount])))
      .toEqual(new Map(allocateMinorUnits(100n, rows).map(r => [r.id, r.amount])));
  });

  it('conserves all allocations over varied deterministic fixtures', () => {
    for (let total = 0n; total < 120n; total++) {
      for (let weight = 1n; weight < 20n; weight++) {
        const result = allocateMinorUnits(total, [
          { id: 'a', weight }, { id: 'b', weight: 3n }, { id: 'c', weight: 0n },
        ]);
        expect(result.reduce((sum, row) => sum + row.amount, 0n)).toBe(total);
        expect(result[2].amount).toBe(0n);
      }
    }
  });

  it('rejects ambiguous/negative allocation inputs', () => {
    expect(() => allocateMinorUnits(1n, [])).toThrow();
    expect(() => allocateMinorUnits(-1n, [{ id: 'a', weight: 1n }])).toThrow();
    expect(() => allocateMinorUnits(1n, [{ id: 'a', weight: -1n }])).toThrow();
    expect(() => allocateMinorUnits(1n, [{ id: 'a', weight: 1n }, { id: 'a', weight: 2n }])).toThrow();
    expect(allocateMinorUnits(0n, [{ id: 'a', weight: 0n }])).toEqual([{ id: 'a', amount: 0n }]);
  });

  it('reverses original merchandise, fee and commission allocations without losing cents', () => {
    for (const original of [100n, 37n, 5n, 0n]) {
      const refunds = [0, 1, 2].map(previous => refundByQuantity(original, 3, previous, 1));
      expect(refunds.reduce((sum, amount) => sum + amount, 0n)).toBe(original);
      expect(refundByQuantity(original, 3, 0, 2)).toBe(refunds[0] + refunds[1]);
    }
    expect([0, 1, 2].map(previous => refundByQuantity(100n, 3, previous, 1))).toEqual([33n, 33n, 34n]);
  });

  it.each([[0, 0, 1], [3, 2, 2], [3, -1, 1], [3, 0, 0], [3, 0, 1.5]])(
    'rejects invalid refund quantities %s/%s/%s', (quantity, previous, additional) => {
      expect(() => refundByQuantity(100n, quantity, previous, additional)).toThrow();
    },
  );

  it('reconciles multiple shops, quantities and funding without crediting sponsored shipping', () => {
    const a = quoteFunding({ merchandise: 4498n, sellerDiscount: 498n, platformDiscount: 500n,
      customerShipping: 0n, expectedShippingSubsidy: 500n });
    const b = quoteFunding({ merchandise: 9000n, sellerDiscount: 0n, platformDiscount: 501n,
      customerShipping: 0n, expectedShippingSubsidy: 750n });
    expect(a.customerPayable + b.customerPayable).toBe(11999n);
    expect(a.platformMerchandiseFunding + b.platformMerchandiseFunding).toBe(1001n);
    expect(a.sellerGross + b.sellerGross).toBe(13000n);
    expect(a.sellerShippingCredit + b.sellerShippingCredit).toBe(0n);
    expect(a.expectedShippingSubsidy + b.expectedShippingSubsidy).toBe(1250n);
    expect(() => quoteFunding({ merchandise: 100n, sellerDiscount: 50n, platformDiscount: 51n,
      customerShipping: 0n, expectedShippingSubsidy: 0n })).toThrow();
  });

  it('refunds only collected shipping and respects handoff and existing refunds', () => {
    const input = { originallyCollected: 500n, previouslyRefunded: 100n,
      entireShopCancelled: true, handedOff: false };
    expect(shippingRefund(input)).toBe(400n);
    expect(shippingRefund({ ...input, handedOff: true })).toBe(0n);
    expect(shippingRefund({ ...input, entireShopCancelled: false })).toBe(0n);
    expect(shippingRefund({ ...input, originallyCollected: 0n, previouslyRefunded: 0n })).toBe(0n);
    expect(shippingRefund({ ...input, handedOff: true, approvedOverride: {
      amount: 200n, actorId: 'super-admin', reason: 'Return approved', evidenceId: 'return-1',
    } })).toBe(200n);
    expect(() => shippingRefund({ ...input, approvedOverride: {
      amount: 401n, actorId: 'super-admin', reason: 'Return approved', evidenceId: 'return-1',
    } })).toThrow();
    expect(() => shippingRefund({ ...input, approvedOverride: {
      amount: 100n, actorId: 'super-admin', reason: '', evidenceId: 'return-1',
    } })).toThrow();
  });
});
