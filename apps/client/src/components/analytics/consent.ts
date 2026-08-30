export const CONSENT_STORAGE_KEY = 'cookie_consent';
export const CONSENT_CHANGED_EVENT = 'ezihubb:consent-changed';
export const OPEN_CONSENT_SETTINGS_EVENT = 'ezihubb:open-consent-settings';

export type ConsentStatus = 'accepted' | 'rejected';

export function readConsent(): ConsentStatus | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return value === 'accepted' || value === 'rejected' ? value : null;
}

export function writeConsent(status: ConsentStatus): void {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, status);
  window.localStorage.setItem('cookie_consent_date', new Date().toISOString());
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
