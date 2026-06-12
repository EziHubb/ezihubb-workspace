// ── Null-safety utilities ─────────────────────────────────────────────────────
// Use these instead of inline `?? 0`, `?? ''`, `?? []` operators in components.

/** Return `val` if non-null, else `fallback` (default `0`) */
export function safeNum(val: number | null | undefined, fallback = 0): number {
  return val ?? fallback;
}

/** Return `val` if non-blank, else `fallback` (default `''`) */
export function safeStr(val: string | null | undefined, fallback = ''): string {
  return val ?? fallback;
}

/** Guarantee the value is an array. Handles null and undefined. */
export function safeArr<T>(val: T[] | null | undefined): T[] {
  return Array.isArray(val) ? val : [];
}

/** Unwrap `{ data: T[] }` API envelope and guarantee an array */
export function unwrapArr<T>(body: unknown): T[] {
  const envelope = body as { data?: T[] } | T[] | null | undefined;
  if (Array.isArray(envelope)) return envelope as T[];
  return safeArr((envelope as { data?: T[] } | null)?.data);
}

/** Return `obj[key]` safely, or `undefined` if obj is null/undefined */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
): T[K] | undefined {
  return obj?.[key];
}

/** Return `true` if value is null or undefined */
export function isNil(val: unknown): val is null | undefined {
  return val == null;
}

/** Return `true` if value is NOT null or undefined */
export function notNil<T>(val: T | null | undefined): val is T {
  return val != null;
}

/** Coerce any value to boolean safely */
export function toBool(val: unknown, fallback = false): boolean {
  if (val == null) return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val === 'true' || val === '1';
  if (typeof val === 'number') return val !== 0;
  return fallback;
}
