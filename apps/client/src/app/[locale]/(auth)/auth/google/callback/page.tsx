'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import type { UserDto } from '@ezihubb/types';
import { GOOGLE_OAUTH_MESSAGE_TYPE, postGoogleOAuthResultToOpener } from '../../../../../../lib/auth/google-oauth-popup';

/**
 * Google OAuth callback handler.
 *
 * The API server redirects here after a Google OAuth attempt, passing:
 *   ?token=<accessToken>&user=<JSON UserDto>&redirect=<optional path>
 * or ?error=<code> on failure.
 *
 * Runs inside the OAuth popup window in the normal flow: hands the result
 * back to the window that opened it via postMessage, then closes itself.
 * Falls back to establishing the session directly (same next-auth
 * 'google-token' provider GoogleSignInButton uses — see auth.options.ts;
 * writing straight to the Zustand store here isn't enough since
 * useSession()-based guards like AccountLayoutClient wouldn't see it) when
 * there's no opener — e.g. the popup was blocked and the caller fell back
 * to a full-page redirect, or someone opened this URL directly.
 */
export default function GoogleCallbackPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token     = searchParams.get('token');
    const userParam = searchParams.get('user');
    const redirect  = searchParams.get('redirect') ?? '/';
    const error     = searchParams.get('error');

    const fail = (code: string) => {
      const posted = postGoogleOAuthResultToOpener({ type: GOOGLE_OAUTH_MESSAGE_TYPE, error: code });
      if (!posted) router.replace('/login?error=oauth_failed');
    };

    if (error || !token || !userParam) {
      fail(error ?? 'oauth_failed');
      return;
    }

    let user: UserDto;
    try {
      user = JSON.parse(userParam) as UserDto;
    } catch {
      fail('oauth_failed');
      return;
    }

    const posted = postGoogleOAuthResultToOpener({ type: GOOGLE_OAUTH_MESSAGE_TYPE, token, user });
    if (posted) return;

    void (async () => {
      const result = await signIn('google-token', {
        redirect:    false,
        accessToken: token,
        user:        JSON.stringify(user),
      });
      if (!result?.ok) {
        fail('oauth_failed');
        return;
      }
      router.replace(redirect);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center h-screen gap-3 text-muted">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">Signing you in…</span>
    </div>
  );
}
