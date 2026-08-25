import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// ── next-intl middleware ───────────────────────────────────────────────────────

const intlMiddleware = createMiddleware(routing);

// ── Attribution cookie names ──────────────────────────────────────────────────

const AFFILIATE_COOKIE = 'ezihubb_affiliate'; // affiliate referralCode
const VISITOR_COOKIE   = 'ezihubb_visitor';   // anonymous UUID for click dedup
const COOKIE_MAX_AGE   = 30 * 24 * 60 * 60; // 30 days in seconds

function applyAttributionCookies(
  response: NextResponse,
  req: NextRequest,
  ref: string | null,
  searchParams: URLSearchParams,
): void {
  if (ref && /^[A-Z0-9]{4,20}$/.test(ref)) {
    response.cookies.set(AFFILIATE_COOKIE, ref, { sameSite: 'lax', path: '/', maxAge: COOKIE_MAX_AGE });
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
  declareLocaleVary(response);
  return response;
}

/**
 * Say out loud that the locale redirect depends on who is asking.
 *
 * `/pages/faq` does not have one destination. It sends an English reader to
 * `/en/pages/faq`, a Vietnamese one to `/vi/...` and a Chinese one to
 * `/zh/...`, chosen from Accept-Language and the NEXT_LOCALE cookie — and it
 * said none of that. Any cache between us and the reader was therefore free to
 * store one visitor's answer and hand it to the next, which is how a
 * Vietnamese buyer ends up on the English site with no way back.
 *
 * Nothing is caching it today (Cloudflare reports DYNAMIC), so this is a fuse
 * rather than a fire. It is also the reason the redirect stays a 307: a 308
 * would tell Google and every browser that the mapping is permanent, and it
 * is not — it is per-reader. "Page with redirect" in Search Console is the
 * correct outcome for these URLs; the prefixed target is what gets indexed.
 */
function declareLocaleVary(response: NextResponse): void {
  const existing = response.headers.get('Vary');
  const needed = ['Accept-Language', 'Cookie'];
  const have = new Set((existing ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean));
  const merged = [...(existing ? [existing] : []), ...needed.filter((h) => !have.has(h.toLowerCase()))];
  if (merged.length) response.headers.set('Vary', merged.join(', '));
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|[^/]+\\.[^/]+).*)'],
};
