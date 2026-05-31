'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../../lib/store/auth.store';

/**
 * Invisible client provider — initializes auth state on app boot.
 *
 * Non-blocking: children render immediately; auth loads asynchronously
 * in the background via a silent refresh-token exchange.
 *
 * This is a named-export alias for AuthInitializer. Use either name.
 */
export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);

  useEffect(() => {
    fetchCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
