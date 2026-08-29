'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';

// Keep track of the token that came from the current next-auth session. The
// API client can rotate the access token independently through its httpOnly
// refresh cookie; a later session refetch must not overwrite that fresh token
// with the older copy stored in the next-auth JWT.
let lastSessionAccessToken: string | null = null;

// Lazy-import auth store to avoid circular dependency at module parse time.
// Safe: this only runs inside useEffect (browser-only).
async function syncToStore(session: Session | null) {
  if (typeof window === 'undefined') return;
  const { useAuthStore } = await import('../../lib/store/auth.store');
  const store = useAuthStore.getState();
  if (session?.user?.accessToken) {
    const sessionAccessToken = session.user.accessToken;
    const token = lastSessionAccessToken === sessionAccessToken && store.accessToken
      ? store.accessToken
      : sessionAccessToken;

    lastSessionAccessToken = sessionAccessToken;
    store.setTokens(token, {
      id:              session.user.id   ?? '',
      email:           session.user.email ?? '',
      firstName:       session.user.firstName ?? '',
      lastName:        session.user.lastName  ?? '',
      role:            session.user.role      as string ?? 'USER',
      avatarUrl:       session.user.avatarUrl ?? null,
      isEmailVerified: true,
    } as Parameters<typeof store.setTokens>[1]);
  } else if (!session) {
    lastSessionAccessToken = null;
    store.clearAuth();
  }
}

/**
 * Bridges next-auth session → shared apiClient in-memory token.
 * Ensures apiFetch / apiClient always have the correct Bearer token
 * without requiring a manual fetchCurrentUser() call on page load.
 */
export function SessionSyncer() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    syncToStore(session);
  }, [session, status]);

  return null;
}
