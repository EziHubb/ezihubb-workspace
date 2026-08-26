/**
 * Turning the seller's calendar into instants, and back.
 *
 * A promotion is stored as two instants, but the seller picks two DAYS in an
 * `<input type="date">`, which yields a bare `YYYY-MM-DD`. Something has to
 * decide when those days begin and end, and only the browser can: it is the
 * one place that knows the seller's timezone. The server sees an instant and
 * has no way to recover which local day was meant.
 *
 * Sending the bare string let the server parse it as UTC midnight, and the two
 * ends failed in opposite directions. A sale starting "today" did not begin
 * until the UTC day did — 7am for a seller at UTC+7 — and a sale ending on a
 * given day stopped at the START of it, so it never ran on its own last day.
 *
 * The reverse direction matters just as much: an instant at local midnight
 * falls on the PREVIOUS calendar day in UTC for any positive offset, so
 * slicing the ISO string to get a date back — which is what this replaced —
 * showed the seller a day earlier than the one they picked.
 */

/** Local-time parts of a `YYYY-MM-DD`, or null if it is not one. */
function parts(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * The instant the seller's chosen day BEGINS, as ISO.
 *
 * `new Date(y, m, d, …)` builds in local time, so `.toISOString()` is the
 * correct instant for that seller's midnight rather than everyone's.
 */
export function startOfLocalDayISO(date?: string | null): string | undefined {
  if (!date) return undefined;
  const p = parts(date);
  if (!p) return date;                       // already a full instant — leave it
  return new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0).toISOString();
}

/**
 * The instant the seller's chosen day ENDS, as ISO.
 *
 * 23:59:59.999, so a sale set to end on a day actually runs through that day.
 * The pricing rule is `expiresAt > now`, so the last millisecond still counts.
 */
export function endOfLocalDayISO(date?: string | null): string | undefined {
  if (!date) return undefined;
  const p = parts(date);
  if (!p) return date;
  return new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999).toISOString();
}

/** An instant from the API back to the `YYYY-MM-DD` a date input expects. */
export function localDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today on the seller's calendar, for date-input floors and comparisons. */
export function todayLocalISODate(): string {
  return localDateInputValue(new Date().toISOString());
}
