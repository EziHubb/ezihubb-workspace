/**
 * Helpers for attaching a video that is already hosted somewhere else, rather
 * than uploading the file to our own storage.
 *
 * Kept as pure functions with no Nest dependencies so the parsing and the
 * host policy can be tested directly — both are the kind of thing that is
 * wrong in a way nobody notices until a product page renders badly.
 */

/**
 * ISO 8601 duration -> seconds. `PT10S` becomes `10`, `PT1M30S` becomes `90`.
 *
 * Only the time part is accepted. A duration in days or months is not a video
 * length, it is a mistake, and silently reading `P1D` as 86400 would store a
 * number no clip could have.
 *
 * Returns null for anything unparseable, which the caller stores as "never
 * measured" rather than rejecting — the duration is metadata, not the video.
 */
export function parseIso8601Duration(input: string | undefined | null): number | null {
  if (!input) return null;
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(input.trim());
  if (!m) return null;
  const [, h, min, s] = m;
  // "PT" on its own matches the pattern but carries no value.
  if (h === undefined && min === undefined && s === undefined) return null;
  const seconds = (Number(h ?? 0) * 3600) + (Number(min ?? 0) * 60) + Number(s ?? 0);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Seed value used only when PARTNER_MEDIA_HOST_ALLOWLIST is not set at all.
 *
 * Deliberately a starter, not a policy. Every host listed here is one whose
 * infrastructure our product pages will hotlink: they control whether the
 * media stays up, they can serve different bytes later under the same URL, and
 * they see a request from every shopper who loads the page. Treat adding a
 * host as a trust decision, not a config tweak.
 */
const DEFAULT_ALLOWED_MEDIA_HOSTS = ['v.etsystatic.com'];

/**
 * The hosts a partner may attach media from.
 *
 * Read from the environment at call time rather than captured at import, so a
 * redeploy is enough to change it and tests can set it per case.
 *
 * Set-but-EMPTY means DENY EVERYTHING, and that is deliberate: `??` only falls
 * back when the variable is absent, so an operator can switch the endpoint off
 * entirely by setting it to an empty string. Failing open on an allowlist
 * would turn the strictest setting into the loosest one.
 */
export function allowedMediaHosts(): string[] {
  const raw = process.env['PARTNER_MEDIA_HOST_ALLOWLIST'];
  if (raw === undefined) return [...DEFAULT_ALLOWED_MEDIA_HOSTS];
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export type MediaUrlRejection =
  | 'ERR_MEDIA_URL_INVALID'
  | 'ERR_MEDIA_URL_NOT_HTTPS'
  | 'ERR_MEDIA_URL_OWN_STORAGE'
  | 'ERR_MEDIA_HOST_NOT_ALLOWED';

export interface MediaUrlCheck {
  ok: boolean;
  reason?: MediaUrlRejection;
  host?: string;
}

/**
 * Validates one externally-hosted media URL.
 *
 * Three gates, in order of how badly they fail:
 *
 * 1. **Parseable, and https.** A `javascript:` or `data:` URL has no business
 *    reaching an attribute we render.
 *
 * 2. **Not our own storage.** This one is not cosmetic. Deleting a video calls
 *    `storage.extractKey(url)` and removes the resulting object; `extractKey`
 *    returns the URL unchanged when it does not recognise the host, so an
 *    external URL deletes nothing. But a URL pointing INTO our own CDN
 *    resolves to a real key — so a partner could attach another store's video
 *    URL to their own product, delete it, and destroy that store's object.
 *    Anything living in our storage must arrive through the upload endpoint,
 *    which knows who owns it.
 *
 * 3. **Host is allowlisted.** Checked last because it is the policy gate; the
 *    two above are correctness and hold regardless of configuration.
 *
 * Subdomains are NOT implicitly allowed. `cdn.example.com` does not grant
 * `evil.cdn.example.com`, and an entry of `example.com` does not grant
 * `example.com.attacker.net` — the comparison is on the full host, exact.
 */
export function checkExternalMediaUrl(
  raw: string,
  isOwnStorageUrl: (url: string) => boolean,
  hosts: string[] = allowedMediaHosts(),
): MediaUrlCheck {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'ERR_MEDIA_URL_INVALID' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'ERR_MEDIA_URL_NOT_HTTPS', host: parsed.host };
  }

  if (isOwnStorageUrl(raw)) {
    return { ok: false, reason: 'ERR_MEDIA_URL_OWN_STORAGE', host: parsed.host };
  }

  const host = parsed.hostname.toLowerCase();
  if (!hosts.includes(host)) {
    return { ok: false, reason: 'ERR_MEDIA_HOST_NOT_ALLOWED', host };
  }

  return { ok: true, host };
}
