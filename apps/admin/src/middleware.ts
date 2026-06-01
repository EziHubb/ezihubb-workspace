import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) =>
      !!token && ['ADMIN', 'SUPER_ADMIN'].includes(token.role as string),
  },
});

// Protect everything except login, NextAuth API routes, Next.js internals
export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|public).*)'],
};
