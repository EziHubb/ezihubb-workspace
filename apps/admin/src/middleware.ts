import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { getAdminRouteRedirect } from './lib/route-guard';
import { resolveInStoreMode, STORE_CONTEXT_COOKIE } from './lib/store-context-shared';

// `apps/admin/src/app/(admin)/layout.tsx` reads the current path server-side
// via `headers().get('x-pathname')` to run its route guards (blocking a shop
// owner from super-admin-only pages, and blocking a platform-context
// super-admin from store-only pages) — Next.js has no built-in way to read
// the request path from a Server Component, so middleware must forward it
// as a request header explicitly. Without this, `headers()` always returns
// null and every one of those guards silently no-ops.
export default withAuth(
  function middleware(req) {
    // The route guard, moved here from (admin)/layout.tsx — see route-guard.ts
    // for why a layout was the wrong place for it. Everything it needs is
    // already on this request: the path from nextUrl, role and storeId from
    // the session token withAuth has just validated, and the store-context
    // cookie the switcher writes.
    const token   = req.nextauth?.token;
    const role    = token?.['role'] as string | undefined;
    const storeId = (token?.['storeId'] as string | null | undefined) ?? null;

    const inStoreMode = resolveInStoreMode(
      storeId,
      req.cookies.get(STORE_CONTEXT_COOKIE)?.value ?? null,
    );

    const target = getAdminRouteRedirect(req.nextUrl.pathname, role, storeId, !inStoreMode);
    if (target && target !== req.nextUrl.pathname) {
      return NextResponse.redirect(new URL(target, req.url));
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-pathname', req.nextUrl.pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow TOTP verify page only for admin sessions pending 2FA completion
        if (req.nextUrl.pathname.startsWith('/totp-verify')) {
          return !!token &&
            token['requiresTOTP'] === true &&
            ['ADMIN', 'SUPER_ADMIN'].includes(token['role'] as string);
        }
        return !!token && ['ADMIN', 'SUPER_ADMIN'].includes(token['role'] as string);
      },
    },
  },
);

// Protect everything except login, NextAuth API routes, Next.js internals,
// and the static brand/favicon assets served from public/ (logo, icons,
// manifest) — these must load unauthenticated since the login page itself
// renders the logo and browser tabs fetch favicons before any session exists.
//
// `images` (public/images/*) must be excluded too, and not only because those
// files aren't sensitive: `next/image` does NOT serve them directly, it
// requests /_next/image?url=… and the optimizer then fetches the source URL
// itself, server-side, WITHOUT the browser's session cookie. With `images`
// protected, that internal fetch got a 307 to the sign-in page instead of a
// PNG, so the optimizer returned 400 and every <Image src="/images/…"> was a
// broken image for logged-in users too — which is exactly how the "Choose
// featured layout" preview broke in production.
export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|public|images|logo\\.png|site\\.webmanifest|favicon-16x16\\.png|favicon-32x32\\.png|apple-touch-icon\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png).*)',
  ],
};
