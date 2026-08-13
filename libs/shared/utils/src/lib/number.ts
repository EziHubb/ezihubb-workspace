// ── Number utilities ──────────────────────────────────────────────────────────

type Numeric = number | string | null | undefined;

function toNum(val: Numeric): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** `12.3` → `"12.30"` (defaults to 2 decimal places) */
export function fmtFixed(val: Numeric, decimals = 2): string {
  return toNum(val).toFixed(decimals);
}

/** `1234.5` → `"$1,235"` (0 decimals by default — for rounded display) */
export function fmtCurrency(val: Numeric, decimals = 0): string {
  return `$${toNum(val).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** `12.345` → `"$12.35"` (always 2 decimals — for exact amounts) */
export function fmtAmount(val: Numeric): string {
  return `$${toNum(val).toFixed(2)}`;
}

/** `0.1234` → `"12.3%"` (pass fractional, not percentage) */
export function fmtPercent(val: Numeric, decimals = 1): string {
  return `${(toNum(val) * 100).toFixed(decimals)}%`;
}

/** `0.1234` (already percentage) → `"12.3%"` */
export function fmtPercentRaw(val: Numeric, decimals = 1): string {
  return `${toNum(val).toFixed(decimals)}%`;
}

/** `1234567` → `"1,234,567"` */
export function fmtNum(val: Numeric): string {
  return toNum(val).toLocaleString();
}

/** `219200` → `"219.2k"`, `1500000` → `"1.5m"` (Etsy-style compact search-volume counts) */
export function fmtCompactNum(val: Numeric): string {
  const n = toNum(val);
  if (n < 1000) return String(Math.round(n));
  // Intl's compact notation renders "219.2K" (uppercase) — Etsy's own
  // trending-term cards use lowercase ("219.2k"), so match that exactly.
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
    .format(n)
    .toLowerCase();
}

/** `4.567` → `"4.6"` (one decimal, for ratings) */
export function fmtRating(val: Numeric): string {
  return toNum(val).toFixed(1);
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
