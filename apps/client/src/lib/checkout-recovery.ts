// Only non-secret references belong here, never contact details, quotes or tokens.
export const CHECKOUT_REQUEST_KEY = 'economic-checkout-request';
export const PENDING_CHECKOUT_KEY = 'economic-pending-checkout';
const valid = (value: string) => /^[A-Za-z0-9_-]{1,100}$/.test(value);

export function readCheckoutReference(key: string): string | null {
  let stored: string | null = null;
  try { stored = sessionStorage.getItem(key); } catch { /* Cookie fallback. */ }
  let cookie: string | null = null;
  try { cookie = document.cookie.split('; ').find(part => part.startsWith(`${key}=`))?.slice(key.length + 1) ?? null; } catch { /* Both mechanisms can be blocked. */ }
  if ((stored && !valid(stored)) || (cookie && !valid(cookie)) || (stored && cookie && stored !== cookie)) {
    throw new Error('Invalid or conflicting checkout reference. Contact support before submitting another order.');
  }
  return stored || cookie;
}

export function writeCheckoutReference(key: string, value: string): boolean {
  if (!valid(value)) throw new Error('Invalid checkout reference');
  let persisted = false;
  try { sessionStorage.setItem(key, value); persisted = sessionStorage.getItem(key) === value; } catch { /* Cookie fallback. */ }
  // Always mirror the opaque identity: later storage failures cannot hide it.
  try {
    document.cookie = `${key}=${value}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    persisted = persisted || document.cookie.split('; ').includes(`${key}=${value}`);
  } catch { /* Manual checkout can still use its in-memory identity. */ }
  return persisted;
}

export function clearCheckoutReference(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* Clearing the cookie is independent. */ }
  try { document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* Storage may be blocked. */ }
}
