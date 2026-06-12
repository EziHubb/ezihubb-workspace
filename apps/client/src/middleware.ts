import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// ── next-intl middleware ───────────────────────────────────────────────────────

const intlMiddleware = createMiddleware(routing);

// ── Auth-protected path prefixes (checked after locale is stripped) ───────────

const PROTECTED_PREFIXES = ['/account', '/affiliate/dashboard', '/affiliate/links', '/affiliate/payouts', '/seller'];
const ADMIN_PREFIXES     = ['/admin'];

const LOCALE_REGEX = new RegExp(
  `^/(${routing.locales.join('|')})(/.*)?$`,
);

// ── Attribution cookie names ──────────────────────────────────────────────────

const AFFILIATE_COOKIE = 'mlh_affiliate'; // legacy affiliate referralCode
const REFERRAL_COOKIE  = 'mlh_ref';       // multi-level referral code
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

function applyAttributionCookies(
  response: NextResponse,
  req: NextRequest,
  ref: string | null,
  searchParams: URLSearchParams,
): void {
  if (ref && /^[A-Z0-9]{4,20}$/.test(ref)) {
    // Set both legacy affiliate cookie and new referral cookie
    response.cookies.set(AFFILIATE_COOKIE, ref, { sameSite: 'lax', path: '/', maxAge: COOKIE_MAX_AGE });
    response.cookies.set(REFERRAL_COOKIE,  ref, { sameSite: 'lax', path: '/', maxAge: COOKIE_MAX_AGE });
  }
  // Buyer referral cookie
  const bref = searchParams.get('bref');
  if (bref && /^[0-9a-f-]{36}$/.test(bref)) {
    response.cookies.set('mlh_buyer_ref', bref, {
      httpOnly: true,
      sameSite: 'lax',
      path:     '/',
      maxAge:   30 * 24 * 60 * 60,
    });
  }
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
  const ref      = (searchParams.get('c') ?? searchParams.get('ref'))?.toUpperCase().trim() ?? null;

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
      applyAttributionCookies(redirect, req, ref, searchParams);
      return redirect;
    }
  }

  const response = intlMiddleware(req);
  applyAttributionCookies(response, req, ref, searchParams);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|[^/]+\\.[^/]+).*)'],
};
