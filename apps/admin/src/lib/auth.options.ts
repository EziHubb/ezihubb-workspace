import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

// ── NEXTAUTH_URL auto-detection ───────────────────────────────────────────────
// NextAuth v4 REQUIRES NEXTAUTH_URL in production to build callback/redirect URLs.
// Preferred: set NEXTAUTH_URL explicitly in Railway admin service Variables.
// Fallbacks try several Railway-injected vars in order.

if (!process.env['NEXTAUTH_URL']) {
  const detected =
    // Railway injects this per-service (most reliable automatic fallback)
    (process.env['RAILWAY_PUBLIC_DOMAIN']
      ? `https://${process.env['RAILWAY_PUBLIC_DOMAIN']}`
      : null) ??
    // Older Railway var name
    (process.env['RAILWAY_STATIC_URL']
      ? `https://${process.env['RAILWAY_STATIC_URL']}`
      : null);

  if (detected) {
    process.env['NEXTAUTH_URL'] = detected;
  } else if (process.env['NODE_ENV'] === 'production') {
    // Log clearly so Railway build logs show why auth is broken
    console.error(
      '[Admin auth] NEXTAUTH_URL is not set and could not be auto-detected. ' +
      'Set NEXTAUTH_URL=https://<your-admin-domain> in Railway Variables.',
    );
  }
}

// ── API base URL ──────────────────────────────────────────────────────────────
// Build the full /api/v1 URL regardless of whether the env var already has the
// path suffix.  Mirrors the normalisation in libs/shared/api-client/src/client.ts.

function buildApiBase(): string {
  const raw =
    process.env['API_URL']              // preferred: server-only var
    ?? process.env['NEXT_PUBLIC_API_URL']  // fallback: build-time public var
    ?? 'http://localhost:3002';

  // Strip any trailing /api/v1 then re-add — makes both forms equivalent.
  return raw.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') + '/api/v1';
}

const API_BASE = buildApiBase();

// ── Auth options ──────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        let res: Response;
        try {
          res = await fetch(`${API_BASE}/auth/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              email:    credentials.email,
              password: credentials.password,
            }),
          });
        } catch (networkErr) {
          // API is unreachable — log in dev, swallow in prod
          if (process.env['NODE_ENV'] !== 'production') {
            console.error('[Admin auth] Network error reaching API:', API_BASE, networkErr);
          }
          return null;
        }

        let body: Record<string, unknown> | null = null;
        try {
          body = await res.json();
        } catch {
          return null;
        }

        if (!res.ok || !body?.data) {
          if (process.env['NODE_ENV'] !== 'production') {
            console.warn('[Admin auth] Login failed — status:', res.status, 'body:', body);
          }
          return null;
        }

        const data = body.data as Record<string, unknown>;
        const user = (data['user'] ?? data) as Record<string, unknown>;

        // Only ADMIN and SUPER_ADMIN roles are allowed
        if (!['ADMIN', 'SUPER_ADMIN'].includes(user['role'] as string)) {
          if (process.env['NODE_ENV'] !== 'production') {
            console.warn('[Admin auth] Blocked — role not permitted:', user['role']);
          }
          return null;
        }

        return {
          id:          String(user['id']),
          email:       String(user['email']),
          name:        (
            `${(user['firstName'] as string) ?? ''} ${(user['lastName'] as string) ?? ''}`.trim()
            || String(user['email'])
          ),
          // Extra fields carried through JWT → session
          role:        user['role'] as string,
          accessToken: data['accessToken'] as string,
        };
      },
    }),
  ],

  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token['id']          = u['id'];
        token['role']        = u['role'];
        token['accessToken'] = u['accessToken'];
      }
      return token;
    },

    session: async ({ session, token }) => {
      const u = session.user as Record<string, unknown> | undefined;
      if (u) {
        u['id']          = token['id'];
        u['role']        = token['role'];
        u['accessToken'] = token['accessToken'];
      }
      return session;
    },
  },

  pages:   { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },

  // Use an explicit secret — never rely on the default in production.
  secret: process.env['NEXTAUTH_SECRET'] ?? 'admin-dev-secret-change-in-production',

  // Debug mode in development only
  debug: process.env['NODE_ENV'] === 'development',
};
