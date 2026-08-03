import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// ── next-intl middleware ───────────────────────────────────────────────────────

const intlMiddleware = createMiddleware(routing);

// ── Attribution cookie names ──────────────────────────────────────────────────

const AFFILIATE_COOKIE = 'ezihubb_affiliate'; // legacy affiliate referralCode
const REFERRAL_COOKIE  = 'ezihubb_ref';       // multi-level referral code
const VISITOR_COOKIE   = 'ezihubb_visitor';   // anonymous UUID for click dedup
const COOKIE_MAX_AGE   = 30 * 24 * 60 * 60; // 30 days in seconds

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
  const { searchParams } = req.nextUrl;
  const ref = (searchParams.get('c') ?? searchParams.get('ref'))?.toUpperCase().trim() ?? null;

  // Auth protection is handled client-side by AccountLayoutClient /
  // SellerLayoutClient. The httpOnly refresh_token is set by the NestJS API
  // on its own domain, so the Next.js server cannot read it here. Attempting
  // a server-side redirect would always block navigation regardless of auth
  // state, creating a redirect loop.
  const response = intlMiddleware(req);
  applyAttributionCookies(response, req, ref, searchParams);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|[^/]+\\.[^/]+).*)'],
};
