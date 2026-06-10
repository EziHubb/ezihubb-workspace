import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import axios, { AxiosError } from 'axios';
import { API_ROUTES } from '@mlh/constants';
// Note: cannot import api-client.ts here — it imports authOptions (circular).
// Use axios directly for the two unauthenticated login calls.

// ── NEXTAUTH_URL auto-detection ───────────────────────────────────────────────
// NextAuth v4 REQUIRES NEXTAUTH_URL in production to build callback/redirect URLs.
// Preferred: set NEXTAUTH_URL explicitly in Railway admin service Variables.
// Fallbacks try several Railway-injected vars in order.

if (!process.env['NEXTAUTH_URL']) {
  const detected =
    // Railway injects this per-service (most reliable automatic fallback)
    (process.env['NEXT_PUBLIC_NEXTAUTH_URL']
      ? `https://${process.env['NEXT_PUBLIC_NEXTAUTH_URL']}`
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
    process.env['API_URL'] ?? // preferred: server-only var
    process.env['NEXT_PUBLIC_API_URL'] ?? // fallback: build-time public var
    'http://localhost:3002';

  // Strip any trailing /api/v1 then re-add — makes both forms equivalent.
  return raw.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') + '/api/v1';
}

const API_BASE = buildApiBase();

// ── Auth options ──────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        partialToken: { label: 'Partial Token', type: 'text' },
        totpCode: { label: 'TOTP Code', type: 'text' },
      },

      async authorize(credentials) {
        // ── STEP 2: TOTP code verification ──────────────────────────────────
        if (credentials?.partialToken && credentials?.totpCode) {
          try {
            const { data: envelope } = await axios.post<{
              data: Record<string, unknown>;
            }>(`${API_BASE}${API_ROUTES.AUTH.TOTP_VERIFY}`, {
              partialToken: credentials.partialToken,
              code: credentials.totpCode,
            });
            const data = envelope.data;
            const user = (data['user'] ?? data) as Record<string, unknown>;
            if (!['ADMIN', 'SUPER_ADMIN'].includes(user['role'] as string))
              return null;
            return {
              id: String(user['id']),
              email: String(user['email']),
              name:
                `${(user['firstName'] as string) ?? ''} ${(user['lastName'] as string) ?? ''}`.trim() ||
                String(user['email']),
              role: user['role'] as string,
              accessToken: data['accessToken'] as string,
            };
          } catch (err) {
            if (process.env['NODE_ENV'] !== 'production') {
              console.error(
                '[Admin auth] TOTP verify failed:',
                (err as AxiosError).message,
              );
            }
            return null;
          }
        }

        // ── STEP 1: Password check ───────────────────────────────────────────
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // The login endpoint uses @Res() (non-passthrough), bypassing TransformInterceptor.
          // Response is the raw service result — no { success, data } envelope.
          const { data: body, status } = await axios.post<
            Record<string, unknown>
          >(
            `${API_BASE}${API_ROUTES.AUTH.LOGIN}`,
            { email: credentials.email, password: credentials.password },
            { validateStatus: (s) => s < 500 },
          );

          // TOTP required (202)
          if (status === 202 || body['requiresTOTP'] === true) {
            return {
              id: 'totp-pending',
              email: credentials.email,
              name: credentials.email,
              requiresTOTP: true,
              partialToken: body['partialToken'] as string,
            } as unknown as import('next-auth').User;
          }

          if (status !== 200 || !body) return null;

          const user = (body['user'] ?? body) as Record<string, unknown>;

          if (!['ADMIN', 'SUPER_ADMIN'].includes(user['role'] as string)) {
            if (process.env['NODE_ENV'] !== 'production') {
              console.warn(
                '[Admin auth] Blocked — role not permitted:',
                user['role'],
              );
            }
            return null;
          }

          return {
            id: String(user['id']),
            email: String(user['email']),
            name:
              `${(user['firstName'] as string) ?? ''} ${(user['lastName'] as string) ?? ''}`.trim() ||
              String(user['email']),
            role: user['role'] as string,
            accessToken: body['accessToken'] as string,
          };
        } catch (err) {
          if (process.env['NODE_ENV'] !== 'production') {
            console.error(
              '[Admin auth] Network error reaching API:',
              API_BASE,
              (err as AxiosError).message,
            );
          }
          return null;
        }
      },
    }),
  ],

  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        if (u['requiresTOTP']) {
          token['requiresTOTP'] = true;
          token['partialToken'] = u['partialToken'];
          token['accessToken'] = undefined;
          token['id'] = undefined;
          token['role'] = undefined;
        } else {
          token['requiresTOTP'] = false;
          token['partialToken'] = undefined;
          token['id'] = u['id'];
          token['role'] = u['role'];
          token['accessToken'] = u['accessToken'];
        }
      }
      return token;
    },

    session: async ({ session, token }) => {
      const u = session.user as Record<string, unknown> | undefined;
      if (u) {
        u['requiresTOTP'] = token['requiresTOTP'];
        u['partialToken'] = token['partialToken'];
        u['id'] = token['id'];
        u['role'] = token['role'];
        u['accessToken'] = token['accessToken'];
      }
      return session;
    },
  },

  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },

  // Use an explicit secret — never rely on the default in production.
  secret:
    process.env['NEXTAUTH_SECRET'] ?? 'admin-dev-secret-change-in-production',

  // Debug mode in development only
  debug: process.env['NODE_ENV'] === 'development',
};
