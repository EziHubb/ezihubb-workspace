import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// ── next-intl middleware ───────────────────────────────────────────────────────

const intlMiddleware = createMiddleware(routing);

// ── Auth-protected path prefixes (checked after locale is stripped) ───────────

const PROTECTED_PREFIXES = ['/account', '/checkout', '/affiliate/dashboard', '/affiliate/links', '/affiliate/payouts'];
const ADMIN_PREFIXES     = ['/admin'];

const LOCALE_REGEX = new RegExp(
  `^/(${routing.locales.join('|')})(/.*)?$`,
);

// ── Affiliate attribution cookie names ────────────────────────────────────────

const AFFILIATE_COOKIE = 'mlh_affiliate'; // stores referralCode
const VISITOR_COOKIE   = 'mlh_visitor';   // anonymous UUID for click dedup
const COOKIE_MAX_AGE   = 30 * 24 * 60 * 60; // 30 days in seconds

function stripLocale(pathname: string): string {
  const m = pathname.match(LOCALE_REGEX);
  return m ? (m[2] ?? '/') : pathname;
}

function extractLocale(pathname: string): string {
  const m = pathname.match(LOCALE_REGEX);
  return m ? m[1] : routing.defaultLocale;
}

function applyAffiliateCookies(
  response: NextResponse,
  req: NextRequest,
  ref: string | null,
): void {
  // Last-click attribution: overwrite existing cookie if new ref present
  if (ref && /^[A-Z0-9]{4,20}$/.test(ref)) {
    response.cookies.set(AFFILIATE_COOKIE, ref, {
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
  }
  // Set visitor UUID if not already present (used for click deduplication)
  if (!req.cookies.has(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export default function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const stripped = stripLocale(pathname);
  const locale   = extractLocale(pathname);
  const ref      = searchParams.get('ref')?.toUpperCase().trim() ?? null;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => stripped === p || stripped.startsWith(`${p}/`),
  );
  const isAdmin = ADMIN_PREFIXES.some((p) => stripped.startsWith(p));

  if (isProtected || isAdmin) {
    // The httpOnly refresh_token cookie is the session indicator.
    // It is set server-side at login and deleted on logout / expiry.
    const hasSession = req.cookies.has('refresh_token');
    if (!hasSession) {
      const loginUrl = new URL(`/${locale}/login`, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      const redirect = NextResponse.redirect(loginUrl);
      // Preserve affiliate cookie even on auth redirects
      applyAffiliateCookies(redirect, req, ref);
      return redirect;
    }
  }

  const response = intlMiddleware(req);
  applyAffiliateCookies(response, req, ref);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|[^/]+\\.[^/]+).*)'],
};
