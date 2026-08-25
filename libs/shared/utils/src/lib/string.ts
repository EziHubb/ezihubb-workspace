// ── String utilities ──────────────────────────────────────────────────────────

/** Truncate to `max` chars, appending `suffix` if cut */
export function truncate(val: string | null | undefined, max: number, suffix = '…'): string {
  if (!val) return '';
  return val.length <= max ? val : val.slice(0, max - suffix.length) + suffix;
}

/** `"hello world"` → `"hello-world"` */
export function slugify(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `"hello world"` → `"Hello World"` */
export function titleCase(val: string | null | undefined): string {
  if (!val) return '';
  return val.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** `"hello world"` → `"Hello world"` */
export function capitalize(val: string | null | undefined): string {
  if (!val) return '';
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
}

/** `"John Doe"` → `"JD"` (first letters of first two words) */
export function initials(val: string | null | undefined, max = 2): string {
  if (!val) return '';
  return val.trim().split(/\s+/).slice(0, max).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

/** `"PENDING_REVIEW"` → `"Pending Review"` */
export function snakeToTitle(val: string | null | undefined): string {
  if (!val) return '';
  return val.split('_').map(capitalize).join(' ');
}

/** `"camelCaseWord"` → `"Camel Case Word"` */
export function camelToTitle(val: string | null | undefined): string {
  if (!val) return '';
  return val.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

/** Returns `true` if the string is blank (null, undefined, or whitespace-only) */
export function isBlank(val: string | null | undefined): boolean {
  return !val || val.trim().length === 0;
}

/** Pad a number or string on the left: `7` → `"007"` */
export function padStart(val: string | number, length: number, fill = '0'): string {
  return String(val).padStart(length, fill);
}

/**
 * A category slug as the noun phrase a page title should use.
 *
 * Slugs arrive from a query string, so a title built by interpolating one
 * directly read "gifts Gifts | EziHubb": lower-cased, and saying the same word
 * twice because the caller appended "Gifts" of its own. Returning the finished
 * phrase keeps that decision in one place — three call sites were each about
 * to make it, and a helper that returned only the label would still have let
 * "gifts" become "Gifts Gifts".
 */
export function categoryGiftTitle(slug: string): string {
  const words = slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

  if (!words.length) return 'Gifts';
  // Already ends in the noun we would append, so append nothing.
  if (/^gifts?$/i.test(words[words.length - 1])) {
    words[words.length - 1] = 'Gifts';
    return words.join(' ');
  }
  return `${words.join(' ')} Gifts`;
}
