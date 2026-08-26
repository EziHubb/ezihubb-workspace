'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { identifyHotjarUser } from '../../lib/analytics/hotjar';
import { toast } from '../../lib/store/toast.store';
import { syncPushToken, setupForegroundMessages } from '../../lib/notifications/push';

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

  // Refresh the FCM token and set up the foreground handler after login.
  useEffect(() => {
    if (!userId) return;

    // syncPushToken never prompts. This effect used to call the version
    // that did, so every login fired Notification.requestPermission() with
    // no gesture behind it — quiet-listed by Chrome, refused by Safari.
    // Asking is PushPermissionPrompt's job now; this only renews the token
    // of someone who already said yes, which it must, because FCM tokens
    // rotate and a stale one silently stops delivering.
    void syncPushToken();

    const unsubscribe = setupForegroundMessages(({ title, body }) => {
      if (title) toast.info(body ? `${title} — ${body}` : title);
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return <>{children}</>;
}
