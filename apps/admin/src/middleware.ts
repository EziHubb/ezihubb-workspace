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

// Protect everything except login, NextAuth API routes, Next.js internals
export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|public).*)'],
};
