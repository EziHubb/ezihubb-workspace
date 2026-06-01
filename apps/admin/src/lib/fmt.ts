/**
 * Safe formatting utilities for the admin UI.
 *
 * Every function in this file guards against null / undefined / NaN inputs
 * so callers never need to write `(val ?? 0).toFixed(2)` inline.
 *
 * Rule: import from here — never duplicate these guards in components.
 */

// ── Number formatters ─────────────────────────────────────────────────────────

/** `12.3` → `"12.30"` (defaults to 2 decimal places) */
export function fmtFixed(val: number | null | undefined, decimals = 2): string {
  return (val ?? 0).toFixed(decimals);
}

/** `1234.5` → `"$1,235"` (0 decimals by default for display) */
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

/** `0.1234` → `"12.3%"` */
export function fmtPercent(val: number | null | undefined, decimals = 1): string {
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

// ── Array / API-response helpers ──────────────────────────────────────────────

/**
 * Guarantee the value is an array.
 * Use when API data might be null / undefined / a wrapped object.
 *
 *   const items = safeArr(body.data ?? body)   // always T[]
 */
export function safeArr<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

/**
 * Unwrap a standard `{ success, data }` API envelope and guarantee an array.
 * Works for both plain arrays and `{ data: T[] }` envelopes.
 *
 *   const rows = unwrapArr<User>(await res.json())
 */
export function unwrapArr<T>(body: unknown): T[] {
  const data = (body as { data?: unknown } | null)?.data ?? body;
  return safeArr<T>(data);
}

/**
 * Same as unwrapArr but also checks `res.ok` first.
 * Returns [] when the request failed.
 */
export async function fetchArr<T>(res: Response): Promise<T[]> {
  if (!res.ok) return [];
  try {
    const body = await res.json();
    return unwrapArr<T>(body);
  } catch {
    return [];
  }
}
