export const CONSENT_STORAGE_KEY = 'cookie_consent';
export const CONSENT_CHANGED_EVENT = 'ezihubb:consent-changed';

export type ConsentStatus = 'accepted' | 'rejected';
// A blocked persistence mechanism is not consent. Explicit choices can still
// be honored for this document without breaking checkout or enabling tracking.
let documentConsent: ConsentStatus | null = null;

export function readConsent(): ConsentStatus | null {
  if (typeof window === 'undefined') return null;
  if (documentConsent !== null) return documentConsent;
  try {
    const fallback = document.cookie.split('; ').find(cookie => cookie.startsWith('cookie_consent_fallback='))?.split('=')[1];
    if (fallback !== undefined) return fallback === 'accepted' || fallback === 'rejected' ? fallback : null;
  } catch { /* Missing storage never implies consent. */ }
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'accepted' || value === 'rejected' ? value : documentConsent;
  } catch { return documentConsent; }
}

export function writeConsent(status: ConsentStatus): void {
  documentConsent = status;
  let persisted = false;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, status);
    persisted = window.localStorage.getItem(CONSENT_STORAGE_KEY) === status;
    window.localStorage.setItem('cookie_consent_date', new Date().toISOString());
  } catch { /* Honor the explicit choice in-memory; never assume it on reload. */ }
  // Preserve an explicit rejection even if an old accepted local-storage value
  // is readable but overwriting it is refused. This essential preference cookie
  // contains no identity or tracking data and overrides that stale value.
  try {
    document.cookie = `cookie_consent_fallback=${status}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    persisted = persisted || document.cookie.split('; ').includes(`cookie_consent_fallback=${status}`);
  } catch { /* Keep the explicit choice in this document. */ }
  if (persisted) documentConsent = null;
  window.dispatchEvent(new CustomEvent<ConsentStatus>(CONSENT_CHANGED_EVENT, { detail: status }));
}

export function clearNonEssentialCookies(): void {
  if (typeof document === 'undefined') return;

  const prefixes = ['_ga', '_gid', '_gat', '_fbp', '_fbc', '_pin_', '_hj'];
  const hostnameParts = window.location.hostname.split('.');
  const domains = ['', window.location.hostname];

  if (hostnameParts.length > 1) {
    domains.push(`.${hostnameParts.slice(-2).join('.')}`);
  }

  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (!name || !prefixes.some((prefix) => name.startsWith(prefix))) continue;

    for (const domain of domains) {
      const domainAttribute = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; Max-Age=0; path=/${domainAttribute}; SameSite=Lax`;
    }
  }
}
