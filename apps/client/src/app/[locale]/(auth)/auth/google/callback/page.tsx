'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserDto } from '@ezihubb/types';
import { useAuthStore } from '../../../../../../lib/store/auth.store';
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
 * Falls back to storing tokens + redirecting directly when there's no opener
 * (e.g. the popup was blocked and the caller fell back to a full-page
 * redirect, or someone opened this URL directly).
 */
export default function GoogleCallbackPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token     = searchParams.get('token');
    const userParam = searchParams.get('user');
    const redirect  = searchParams.get('redirect') ?? '/';
    const error     = searchParams.get('error');

    if (error || !token || !userParam) {
      const posted = postGoogleOAuthResultToOpener({
        type: GOOGLE_OAUTH_MESSAGE_TYPE,
        error: error ?? 'oauth_failed',
      });
      if (!posted) router.replace('/login?error=oauth_failed');
      return;
    }

    try {
      const user = JSON.parse(userParam) as UserDto;
      const posted = postGoogleOAuthResultToOpener({ type: GOOGLE_OAUTH_MESSAGE_TYPE, token, user });
      if (!posted) {
        useAuthStore.getState().setTokens(token, user);
        router.replace(redirect);
      }
    } catch {
      const posted = postGoogleOAuthResultToOpener({ type: GOOGLE_OAUTH_MESSAGE_TYPE, error: 'oauth_failed' });
      if (!posted) router.replace('/login?error=oauth_failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center h-screen gap-3 text-muted">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">Signing you in…</span>
    </div>
  );
}
