import {
  fmtCurrency,
  fmtAmount,
  fmtFixed,
  fmtPercent,
  fmtNum,
  parseAmount,
  clamp,
  centsToDollars,
  dollarsToCents,
} from '../lib/number';

describe('number utils', () => {
  describe('fmtFixed', () => {
    it('formats number to 2 decimal places by default', () =>
      expect(fmtFixed(27.9912)).toBe('27.99'));
    it('returns "0.00" for null (coerces to 0)', () =>
      expect(fmtFixed(null)).toBe('0.00'));
    it('returns "0.00" for undefined (coerces to 0)', () =>
      expect(fmtFixed(undefined)).toBe('0.00'));
    it('formats 0 correctly', () =>
      expect(fmtFixed(0)).toBe('0.00'));
    it('uses custom decimals', () =>
      expect(fmtFixed(27.9, 0)).toBe('28'));
  });

  describe('fmtCurrency', () => {
    it('formats number as currency with 0 decimals (rounded)', () => {
      // 27.99 rounds to 28 at 0 decimals
      const result = fmtCurrency(27.99);
      expect(result).toBe('$28');
    });
    it('formats with explicit decimals', () => {
      expect(fmtCurrency(27.99, 2)).toBe('$27.99');
    });
    it('returns "$0" for null (coerces to 0)', () =>
      expect(fmtCurrency(null)).toBe('$0'));
    it('returns "$0" for undefined (coerces to 0)', () =>
      expect(fmtCurrency(undefined)).toBe('$0'));
  });

  describe('fmtAmount', () => {
    it('formats amount with $ prefix and 2 decimals', () => {
      expect(fmtAmount(27.99)).toBe('$27.99');
    });
    it('returns "$0.00" for null (coerces to 0)', () =>
      expect(fmtAmount(null)).toBe('$0.00'));
  });

  describe('fmtPercent', () => {
    it('formats fractional number as percent', () => {
      // 0.154 * 100 = 15.4%
      expect(fmtPercent(0.154)).toBe('15.4%');
    });
    it('returns "0.0%" for null (coerces to 0)', () =>
      expect(fmtPercent(null)).toBe('0.0%'));
  });

  describe('fmtNum', () => {
    it('formats large number with commas', () => {
      const result = fmtNum(1234567);
      expect(result).toContain('1');
    });
    it('returns "0" for null (coerces to 0)', () =>
      expect(fmtNum(null)).toBe('0'));
  });

  describe('parseAmount', () => {
    it('parses string to number', () =>
      expect(parseAmount('27.99')).toBe(27.99));
    it('returns 0 for null', () =>
      expect(parseAmount(null)).toBe(0));
    it('returns 0 for undefined', () =>
      expect(parseAmount(undefined)).toBe(0));
    it('returns 0 for empty string', () =>
      expect(parseAmount('')).toBe(0));
    it('handles numeric input', () =>
      expect(parseAmount(42)).toBe(42));
  });

  describe('clamp', () => {
    it('returns value within range', () =>
      expect(clamp(50, 0, 100)).toBe(50));
    it('clamps to max', () =>
      expect(clamp(150, 0, 100)).toBe(100));
    it('clamps to min', () =>
      expect(clamp(-10, 0, 100)).toBe(0));
    it('returns exact min', () =>
      expect(clamp(0, 0, 100)).toBe(0));
    it('returns exact max', () =>
      expect(clamp(100, 0, 100)).toBe(100));
  });

  describe('centsToDollars', () => {
    it('converts cents to dollars', () =>
      expect(centsToDollars(2799)).toBe(27.99));
    it('returns 0 for null', () =>
      expect(centsToDollars(null)).toBe(0));
    it('handles 0', () =>
      expect(centsToDollars(0)).toBe(0));
  });

  describe('dollarsToCents', () => {
    it('converts dollars to cents', () =>
      expect(dollarsToCents(27.99)).toBe(2799));
    it('returns 0 for null', () =>
      expect(dollarsToCents(null)).toBe(0));
  });
});
