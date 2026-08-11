import { withAuth } from 'next-auth/middleware';

export default withAuth({
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
});

// Protect everything except login, NextAuth API routes, Next.js internals,
// and the static brand/favicon assets served from public/ (logo, icons,
// manifest) — these must load unauthenticated since the login page itself
// renders the logo and browser tabs fetch favicons before any session exists.
export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|public|logo\\.png|site\\.webmanifest|favicon-16x16\\.png|favicon-32x32\\.png|apple-touch-icon\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png).*)',
  ],
};
