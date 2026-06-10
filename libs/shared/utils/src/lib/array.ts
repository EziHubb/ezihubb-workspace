// ── Array utilities ───────────────────────────────────────────────────────────

/** Remove null / undefined values from an array */
export function compact<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((v): v is T => v != null);
}

/** Deduplicate an array (by reference equality) */
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Deduplicate by a key extractor */
export function uniqueBy<T>(arr: T[], key: (item: T) => unknown): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Group an array into a record by key extractor */
export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

/** Split array into chunks of `size` */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Sum a numeric field across an array */
export function sumBy<T>(arr: T[], getValue: (item: T) => number): number {
  return arr.reduce((s, item) => s + getValue(item), 0);
}

/** Sort a copy of an array by a key, ascending */
export function sortBy<T>(arr: T[], key: (item: T) => string | number): T[] {
  return [...arr].sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** Move an item from one index to another (immutable) */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
