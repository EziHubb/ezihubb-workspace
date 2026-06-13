// ── Date utilities ────────────────────────────────────────────────────────────

const LOCALE = 'en-US';

/** Vietnam timezone — UTC+7 */
export const VN_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Format a date as "2026-06-13 09:42:02" in Vietnam local time (UTC+7).
 * Used in CSV/spreadsheet exports so timestamps are human-readable.
 */
export function fmtDateTimeVN(val: string | Date | null | undefined): string {
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
export function fmtDateISOVN(val: string | Date | null | undefined): string {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('sv', { timeZone: VN_TZ });
  } catch {
    return '';
  }
}

/** ISO string or Date → `"Jan 5, 2025"` */
export function fmtDate(val: string | Date | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(LOCALE, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/** ISO string or Date → `"Jan 5, 2025 at 3:42 PM"` */
export function fmtDateTime(val: string | Date | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString(LOCALE, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** ISO string or Date → `"3:42 PM"` */
export function fmtTime(val: string | Date | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleTimeString(LOCALE, {
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** ISO string or Date → `"2025-01-05"` (yyyy-mm-dd) */
export function fmtDateISO(val: string | Date | null | undefined): string {
  if (!val) return '';
  try {
    return new Date(val).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/** Relative time: `"2 hours ago"`, `"in 3 days"` */
export function fmtRelative(val: string | Date | null | undefined): string {
  if (!val) return '—';
  try {
    const diff = Date.now() - new Date(val).getTime();
    const abs  = Math.abs(diff);
    const past = diff > 0;
    const suffix = past ? ' ago' : ' from now';

    if (abs < 60_000)       return 'just now';
    if (abs < 3_600_000)    return `${Math.round(abs / 60_000)} min${suffix}`;
    if (abs < 86_400_000)   return `${Math.round(abs / 3_600_000)} hr${suffix}`;
    if (abs < 2_592_000_000) return `${Math.round(abs / 86_400_000)} day${suffix}`;
    return fmtDate(val);
  } catch {
    return '—';
  }
}

/** Check if a date is today */
export function isToday(val: string | Date | null | undefined): boolean {
  if (!val) return false;
  const d = new Date(val);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() &&
         d.getMonth()    === n.getMonth()    &&
         d.getDate()     === n.getDate();
}
