'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { identifyHotjarUser } from '../../lib/analytics/hotjar';
import { toast } from '../../lib/store/toast.store';
import { api } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { initPushNotifications, setupForegroundMessages } from '../../lib/notifications/push';

export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const role   = session?.user?.role ?? 'USER';

  // Link Hotjar session to user once identity is known.
  // Only userId and role are sent — no PII in attributes.
  useEffect(() => {
    if (!userId) return;
    identifyHotjarUser(userId, { role });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Register FCM token and set up foreground message handler after login.
  useEffect(() => {
    if (!userId) return;

    initPushNotifications()
      .then((token) => {
        if (!token) return;
        // eslint-disable-next-line @typescript-eslint/no-empty-function -- best-effort; push notifications are optional
        api.post(API_ROUTES.USERS.FCM_TOKEN, { token, platform: 'web' }).catch(() => {});
      })
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- push notifications are optional, never blocks auth
      .catch(() => {});

    const unsubscribe = setupForegroundMessages(({ title, body }) => {
      if (title) toast.info(body ? `${title} — ${body}` : title);
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return <>{children}</>;
}
