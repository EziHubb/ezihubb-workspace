'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../../lib/store/auth.store';
import { identifyHotjarUser } from '../../lib/analytics/hotjar';

export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const user             = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Link Hotjar session to user once identity is known.
  // Only userId and role are sent — no PII in attributes.
  useEffect(() => {
    if (!user?.id) return;
    identifyHotjarUser(user.id, { role: user.role ?? 'USER' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <>{children}</>;
}
