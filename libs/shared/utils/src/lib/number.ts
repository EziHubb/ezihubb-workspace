// ── Number utilities ──────────────────────────────────────────────────────────

/** `12.3` → `"12.30"` (defaults to 2 decimal places) */
export function fmtFixed(val: number | null | undefined, decimals = 2): string {
  return (val ?? 0).toFixed(decimals);
}

/** `1234.5` → `"$1,235"` (0 decimals by default — for rounded display) */
export function fmtCurrency(val: number | null | undefined, decimals = 0): string {
  return `$${(val ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** `12.345` → `"$12.35"` (always 2 decimals — for exact amounts) */
export function fmtAmount(val: number | null | undefined): string {
  return `$${(val ?? 0).toFixed(2)}`;
}

/** `0.1234` → `"12.3%"` (pass fractional, not percentage) */
export function fmtPercent(val: number | null | undefined, decimals = 1): string {
  return `${((val ?? 0) * 100).toFixed(decimals)}%`;
}

/** `0.1234` (already percentage) → `"12.3%"` */
export function fmtPercentRaw(val: number | null | undefined, decimals = 1): string {
  return `${(val ?? 0).toFixed(decimals)}%`;
}

/** `1234567` → `"1,234,567"` */
export function fmtNum(val: number | null | undefined): string {
  return (val ?? 0).toLocaleString();
}

/** `4.567` → `"4.6"` (one decimal, for ratings) */
export function fmtRating(val: number | null | undefined): string {
  return (val ?? 0).toFixed(1);
}

/** Parse a string or number to float; return 0 on failure */
export function parseAmount(val: string | number | null | undefined): number {
  if (val == null || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Clamp a number between min and max */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/** Convert cents to dollars */
export function centsToDollars(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

/** Convert dollars to cents (rounded) */
export function dollarsToCents(dollars: number | null | undefined): number {
  return Math.round((dollars ?? 0) * 100);
}
