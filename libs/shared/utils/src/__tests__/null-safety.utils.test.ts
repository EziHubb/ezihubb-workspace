import {
  safeNum,
  safeStr,
  safeArr,
  isNil,
  notNil,
  toBool,
} from '../lib/null-safety';

describe('null-safety utils', () => {
  describe('safeNum', () => {
    it('returns value for valid number', () =>
      expect(safeNum(42)).toBe(42));
    it('returns fallback for null', () =>
      expect(safeNum(null)).toBe(0));
    it('returns fallback for undefined', () =>
      expect(safeNum(undefined)).toBe(0));
    it('uses custom fallback', () =>
      expect(safeNum(null, 99)).toBe(99));
    it('returns 0 correctly (not fallback)', () =>
      expect(safeNum(0)).toBe(0));
  });

  describe('safeStr', () => {
    it('returns value for valid string', () =>
      expect(safeStr('hello')).toBe('hello'));
    it('returns fallback for null', () =>
      expect(safeStr(null)).toBe(''));
    it('returns fallback for undefined', () =>
      expect(safeStr(undefined)).toBe(''));
    it('returns empty string correctly (not fallback)', () =>
      expect(safeStr('')).toBe(''));
    it('uses custom fallback', () =>
      expect(safeStr(null, 'default')).toBe('default'));
  });

  describe('safeArr', () => {
    it('returns array unchanged', () =>
      expect(safeArr([1, 2, 3])).toEqual([1, 2, 3]));
    it('returns [] for null', () =>
      expect(safeArr(null)).toEqual([]));
    it('returns [] for undefined', () =>
      expect(safeArr(undefined)).toEqual([]));
    it('returns [] for empty array', () =>
      expect(safeArr([])).toEqual([]));
  });

  describe('isNil', () => {
    it('returns true for null', () =>
      expect(isNil(null)).toBe(true));
    it('returns true for undefined', () =>
      expect(isNil(undefined)).toBe(true));
    it('returns false for 0', () =>
      expect(isNil(0)).toBe(false));
    it('returns false for empty string', () =>
      expect(isNil('')).toBe(false));
    it('returns false for false', () =>
      expect(isNil(false)).toBe(false));
  });

  describe('notNil', () => {
    it('returns true for non-null value', () =>
      expect(notNil('hello')).toBe(true));
    it('returns true for 0', () =>
      expect(notNil(0)).toBe(true));
    it('returns false for null', () =>
      expect(notNil(null)).toBe(false));
    it('returns false for undefined', () =>
      expect(notNil(undefined)).toBe(false));
  });

  describe('toBool', () => {
    it('returns true for true', () =>
      expect(toBool(true)).toBe(true));
    it('returns false for false', () =>
      expect(toBool(false)).toBe(false));
    it('returns true for string "true"', () =>
      expect(toBool('true')).toBe(true));
    it('returns true for string "1"', () =>
      expect(toBool('1')).toBe(true));
    it('returns false for arbitrary string (only "true"/"1" are truthy)', () =>
      expect(toBool('yes')).toBe(false));
    it('returns false for null with default false', () =>
      expect(toBool(null)).toBe(false));
    it('uses custom fallback', () =>
      expect(toBool(null, true)).toBe(true));
  });
});
