/**
 * Surface a rejected `Promise.allSettled` branch in the server log.
 *
 * Several storefront pages fetch optional sections with `Promise.allSettled`
 * and fall back to `[]` / `null` so one bad endpoint can't take the whole page
 * down. That is the right call for availability, but it makes a broken
 * endpoint indistinguishable from "there is genuinely no data": the section
 * just stops rendering, with nothing logged anywhere.
 *
 * That is not hypothetical. `GET /reviews?featured=true` returned 400 for
 * weeks — the API's ValidationPipe rejects unknown query params — so the
 * homepage's featured-reviews section silently disappeared and no error was
 * recorded on either side.
 *
 * These call sites are Server Components, so this writes to the container's
 * stdout (`docker compose logs client`) and is never sent to the browser.
 * Deliberately does NOT throw or change what renders: the fallback behaviour
 * is intentional, this only makes it observable.
 */
export function warnIfRejected(
  /** Where it happened — `page:section`, e.g. `home:featuredReviews`. */
  section: string,
  /** The endpoint that was called, so the log is actionable without reading code. */
  endpoint: string,
  result: PromiseSettledResult<unknown>,
): void {
  if (result.status !== 'rejected') return;

  const reason = result.reason as
    | { status?: number; statusCode?: number; message?: string }
    | undefined;
  const status = reason?.status ?? reason?.statusCode;

  console.warn(
    `[section-fetch-failed] ${section} — GET ${endpoint}` +
      (status ? ` → HTTP ${status}` : '') +
      ` — ${reason?.message ?? String(result.reason)}` +
      ' — section will not render',
  );
}
