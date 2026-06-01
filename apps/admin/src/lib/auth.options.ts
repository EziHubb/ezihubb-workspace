import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002/api/v1';

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res  = await fetch(`${BASE}/auth/login`, {
            method:  'POST',
            body:    JSON.stringify({ email: credentials.email, password: credentials.password }),
            headers: { 'Content-Type': 'application/json' },
          });
          const body = await res.json().catch(() => null);
          if (!res.ok || !body?.data) return null;
          const user = body.data.user ?? body.data;
          if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
          return {
            id:          user.id,
            email:       user.email,
            name:        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
            role:        user.role,
            accessToken: body.data.accessToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id          = user.id;
        token.role        = (user as unknown as Record<string, unknown>)['role'] as string;
        token.accessToken = (user as unknown as Record<string, unknown>)['accessToken'] as string;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        (session.user as Record<string, unknown>)['id']          = token.id;
        (session.user as Record<string, unknown>)['role']        = token.role;
        (session.user as Record<string, unknown>)['accessToken'] = token.accessToken;
      }
      return session;
    },
  },
  pages:   { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  secret:  process.env['NEXTAUTH_SECRET'] ?? 'admin-dev-secret-change-in-production',
};
