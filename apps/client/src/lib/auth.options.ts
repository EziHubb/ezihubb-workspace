import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { API_ROUTES } from '@ezihubb/constants';

// ── NEXTAUTH_URL auto-detection ───────────────────────────────────────────────
// Mirrors the same pattern used in apps/admin/src/lib/auth.options.ts.

if (!process.env['NEXTAUTH_URL']) {
  const detected = process.env['NEXT_PUBLIC_NEXTAUTH_URL'] ?? process.env['CLIENT_URL'];

  if (detected) {
    process.env['NEXTAUTH_URL'] = detected;
  } else if (process.env['NODE_ENV'] === 'production') {
    console.error(
      '[Client auth] NEXTAUTH_URL is not set and could not be auto-detected. ' +
        'Set NEXTAUTH_URL=https://<your-client-domain> in the server environment.',
    );
  }
}

// ── API base URL ──────────────────────────────────────────────────────────────

function buildApiBase(): string {
  const raw =
    process.env['API_URL'] ??
    process.env['NEXT_PUBLIC_API_URL'] ??
    'http://localhost:3002';
  return raw.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') + '/api/v1';
}

const API_BASE = buildApiBase();

// ── Auth options ──────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email:      { label: 'Email',       type: 'email' },
        password:   { label: 'Password',    type: 'password' },
        rememberMe: { label: 'Remember Me', type: 'text' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_BASE}${API_ROUTES.AUTH.LOGIN}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:      credentials.email,
              password:   credentials.password,
              rememberMe: credentials.rememberMe === 'true',
            }),
            // validateStatus < 500: we handle 4xx ourselves
          });

          // Parse body regardless of status so we can read error codes
          const body = await res.json().catch(() => ({})) as Record<string, unknown>;

          if (!res.ok) {
            // Surface specific API error codes so the login form can show the
            // correct message.  next-auth passes Error.message as result.error
            // when the caller uses { redirect: false }.
            const code = (body as { error?: { code?: string } }).error?.code;
            throw new Error(code ?? 'ERR_CREDENTIALS_INVALID');
          }

          // Handle both raw { accessToken, user } (bypass interceptor) and
          // the { success, data: { accessToken, user }, meta } envelope.
          const data  = (body['data']  ?? body) as Record<string, unknown>;
          const user  = (data['user']  ?? data) as Record<string, unknown>;
          const token = data['accessToken'] as string | undefined;

          if (!token || !user?.['id']) return null;

          return {
            id:         String(user['id']),
            email:      String(user['email']     ?? credentials.email),
            name:       (`${user['firstName'] ?? ''} ${user['lastName'] ?? ''}`).trim() ||
                        String(user['email'] ?? credentials.email),
            role:       user['role']       as string | undefined,
            firstName:  user['firstName']  as string | undefined,
            lastName:   user['lastName']   as string | undefined,
            avatarUrl:  user['avatarUrl']  as string | null | undefined,
            accessToken: token,
          };
        } catch (err) {
          if (err instanceof Error) throw err; // re-throw with original message
          return null;
        }
      },
    }),
  ],

  callbacks: {
    jwt: async ({ token, user }) => {
      // On initial sign-in: copy everything from the user object into the JWT
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token['id']          = u['id']          as string | undefined;
        token['role']        = u['role']        as string | undefined;
        token['firstName']   = u['firstName']   as string | undefined;
        token['lastName']    = u['lastName']    as string | undefined;
        token['avatarUrl']   = u['avatarUrl']   as string | null | undefined;
        token['accessToken'] = u['accessToken'] as string | undefined;
      }
      return token;
    },

    session: async ({ session, token }) => {
      // Copy JWT fields onto session.user so client components can read them
      const u = session.user as Record<string, unknown> | undefined;
      if (u) {
        u['id']          = token['id'];
        u['role']        = token['role'];
        u['firstName']   = token['firstName'];
        u['lastName']    = token['lastName'];
        u['avatarUrl']   = token['avatarUrl'];
        u['accessToken'] = token['accessToken'];
      }
      return session;
    },
  },

  pages: {
    signIn: '/en/login',
    error:  '/en/login',
  },

  // JWT strategy — no database required; session survives across deploys.
  // maxAge matches the NestJS refresh-token lifetime (30 days by default).
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  secret:
    process.env['NEXTAUTH_SECRET'] ??
    process.env['NEXT_PUBLIC_NEXTAUTH_SECRET'] ??
    'client-dev-secret-change-in-production',

  debug: process.env['NODE_ENV'] === 'development',
};
