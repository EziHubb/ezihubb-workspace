const AUTH_PAGE_SEGMENTS = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
]);

function isSafeInternalPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false;
  }

  try {
    const url = new URL(value, 'https://ezihubb.local');
    if (url.origin !== 'https://ezihubb.local') return false;

    const segments = url.pathname.split('/').filter(Boolean);
    const pageSegment = segments.length > 1 ? segments[1] : segments[0];
    return !pageSegment || !AUTH_PAGE_SEGMENTS.has(pageSegment);
  } catch {
    return false;
  }
}

/**
 * Resolve a post-auth destination without allowing external/open redirects or
 * sending the user back to another auth page (which would create a loop).
 */
export function resolveAuthRedirect(value: string | null | undefined, fallback: string): string {
  return value && isSafeInternalPath(value) ? value : fallback;
}

/** Build a locale-aware login URL that returns to the current storefront URL. */
export function buildLoginHref(locale: string, returnTo: string): string {
  const safeReturnTo = resolveAuthRedirect(returnTo, `/${locale}/account`);
  return `/${locale}/login?redirect=${encodeURIComponent(safeReturnTo)}`;
}
