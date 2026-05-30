'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../../lib/store/auth.store';

/**
 * Invisible component that runs at app boot.
 * Attempts a silent token refresh so the user remains logged in
 * after a page reload (their refresh cookie is still valid).
 */
export function AuthInitializer() {
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);

  useEffect(() => {
    // Only attempt refresh client-side (no-op if no refresh cookie)
    fetchCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
