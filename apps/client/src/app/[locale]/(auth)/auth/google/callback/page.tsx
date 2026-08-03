'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserDto } from '@ezihubb/types';
import { useAuthStore } from '../../../../../../lib/store/auth.store';

/**
 * Google OAuth callback handler.
 *
 * The API server redirects here after a successful Google OAuth flow, passing:
 *   ?token=<accessToken>&user=<URLencoded JSON UserDto>&redirect=<optional path>
 *
 * On success: stores tokens, redirects to the intended destination.
 * On failure: redirects to /login?error=oauth_failed.
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
      router.replace('/login?error=oauth_failed');
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userParam)) as UserDto;
      useAuthStore.getState().setTokens(token, user);
      router.replace(redirect);
    } catch {
      router.replace('/login?error=oauth_failed');
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
