'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../../lib/store/auth.store';
import { identifyHotjarUser } from '../../lib/analytics/hotjar';
import { toast } from '../../lib/store/toast.store';
import { api } from '@mlh/api-client';
import { initPushNotifications, setupForegroundMessages } from '../../lib/notifications/push';

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

  // Register FCM token and set up foreground message handler after login.
  useEffect(() => {
    if (!user?.id) return;

    // Request permission + register token (fire-and-forget)
    initPushNotifications()
      .then((token) => {
        if (!token) return;
        api.post('/users/me/fcm-token', { token, platform: 'web' }).catch(() => {});
      })
      .catch(() => {});

    // Show foreground push messages as in-app toasts
    const unsubscribe = setupForegroundMessages(({ title, body }) => {
      if (title) toast.info(body ? `${title} — ${body}` : title);
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <>{children}</>;
}
