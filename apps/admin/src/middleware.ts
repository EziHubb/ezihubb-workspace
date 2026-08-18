import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

// `apps/admin/src/app/(admin)/layout.tsx` reads the current path server-side
// via `headers().get('x-pathname')` to run its route guards (blocking a shop
// owner from super-admin-only pages, and blocking a platform-context
// super-admin from store-only pages) — Next.js has no built-in way to read
// the request path from a Server Component, so middleware must forward it
// as a request header explicitly. Without this, `headers()` always returns
// null and every one of those guards silently no-ops.
export default withAuth(
  function middleware(req) {
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
