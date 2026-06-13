/** Vietnam timezone — UTC+7 */
export const VN_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Format a date as "2026-06-13 09:42:02" in Vietnam local time (UTC+7).
 * Used in CSV/spreadsheet exports so timestamps are human-readable.
 * The 'sv' (Swedish) locale produces ISO-style "YYYY-MM-DD HH:mm:ss".
 */
export function fmtDateTimeVN(val: Date | string | null | undefined): string {
  if (!val) return '';
  try {
    return new Date(val).toLocaleString('sv', { timeZone: VN_TZ });
  } catch {
    return '';
  }
}

/**
 * Format a date as "2026-06-13" in Vietnam local time (UTC+7).
 * Used in export filenames.
 */
export function fmtDateISOVN(val: Date | string | null | undefined): string {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('sv', { timeZone: VN_TZ });
  } catch {
    return '';
  }
}
