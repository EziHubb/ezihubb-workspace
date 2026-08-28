import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { API_ROUTES } from '@ezihubb/constants';

// ── NEXTAUTH_URL storefront isolation ────────────────────────────────────────
// Storefront must not inherit the Admin URL from the shared environment.

// Client and Admin run from the same docker-compose .env file. That file's
// historical NEXTAUTH_URL belongs to Admin, so merely using it when present
// makes the storefront advertise admin.ezihubb.com callback URLs and sends a
// successful Google login into a /login <-> /account redirect loop.
//
// Always derive this process's URL from storefront-specific variables. Each
// Next.js app runs in its own container, so overriding NEXTAUTH_URL here is
// isolated to the client process and cannot affect Admin.
const storefrontAuthUrl =
  process.env['APP_URL'] ??
  process.env['NEXT_PUBLIC_NEXTAUTH_URL'] ??
  process.env['CLIENT_URL'];

if (storefrontAuthUrl) {
  process.env['NEXTAUTH_URL'] = storefrontAuthUrl;
} else if (process.env['NODE_ENV'] === 'production') {
  console.error(
    '[Client auth] Storefront auth URL could not be detected. ' +
      'Set APP_URL=https://<your-client-domain> in the server environment.',
  );
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

    // Google Identity Services (One Tap / button) and the legacy Google OAuth
    // redirect both verify the Google credential and issue our own
    // accessToken server-side (POST /auth/google/token, or the /auth/google
    // /callback redirect) *before* this ever runs — this provider's only job
    // is wrapping that already-trusted pair into a next-auth session so
    // SessionSyncer and useSession()-based guards (AccountLayoutClient etc.)
    // see the user as signed in. It does not talk to the API at all.
    Credentials({
      id:   'google-token',
      name: 'Google',
      credentials: {
        accessToken: { label: 'Access Token', type: 'text' },
        user:        { label: 'User',         type: 'text' }, // JSON-encoded UserDto
      },

      async authorize(credentials) {
        if (!credentials?.accessToken || !credentials?.user) return null;

        try {
          const user = JSON.parse(credentials.user) as Record<string, unknown>;
          if (!user?.['id']) return null;

          return {
            id:         String(user['id']),
            email:      String(user['email'] ?? ''),
            name:       (`${user['firstName'] ?? ''} ${user['lastName'] ?? ''}`).trim() ||
                        String(user['email'] ?? ''),
            role:       user['role']       as string | undefined,
            firstName:  user['firstName']  as string | undefined,
            lastName:   user['lastName']   as string | undefined,
            avatarUrl:  user['avatarUrl']  as string | null | undefined,
            accessToken: credentials.accessToken,
          };
        } catch {
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
  // maxAge matches the NestJS refresh-token lifetime (7 days).
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },

  secret:
    process.env['NEXTAUTH_SECRET'] ??
    process.env['NEXT_PUBLIC_NEXTAUTH_SECRET'] ??
    'client-dev-secret-change-in-production',

  debug: process.env['NODE_ENV'] === 'development',
};
