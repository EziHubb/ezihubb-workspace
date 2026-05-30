import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// ── next-intl middleware ───────────────────────────────────────────────────────

const intlMiddleware = createMiddleware(routing);

// ── Auth-protected path prefixes (checked after locale is stripped) ───────────

const PROTECTED_PREFIXES = ['/account', '/checkout'];
const ADMIN_PREFIXES     = ['/admin'];

const LOCALE_REGEX = new RegExp(
  `^/(${routing.locales.join('|')})(/.*)?$`,
);

function stripLocale(pathname: string): string {
  const m = pathname.match(LOCALE_REGEX);
  return m ? (m[2] ?? '/') : pathname;
}

function extractLocale(pathname: string): string {
  const m = pathname.match(LOCALE_REGEX);
  return m ? m[1] : routing.defaultLocale;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const stripped = stripLocale(pathname);
  const locale   = extractLocale(pathname);

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
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|[^/]+\\.[^/]+).*)'],
};
