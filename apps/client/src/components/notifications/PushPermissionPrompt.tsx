'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { toast } from '../../lib/store/toast.store';
import { isPushSupported, pushPermission, requestPushPermission } from '../../lib/notifications/push';

const DISMISSED_KEY = 'push_prompt_dismissed';

/**
 * Asks in our own UI before asking the browser.
 *
 * The browser dialog is a one-shot resource: a user who dismisses it is a
 * permanent denial we cannot re-open, and Chrome demotes any request without a
 * gesture behind it to a quiet icon most people never notice. Safari is
 * stricter still — it refuses an ungestured request outright, which is why the
 * old code, which asked automatically on login, produced no dialog at all on
 * Apple devices.
 *
 * So the click on "Turn on" below is not decoration. It is the gesture that
 * makes the real request legal, and it means a no costs us nothing permanent.
 */
export function PushPermissionPrompt() {
  const t = useTranslations('common.pushPrompt');
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [show, setShow]     = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    // Push is per-account: the token is stored against a user, so there is
    // nothing to ask a signed-out visitor for.
    if (!userId) return;
    if (!isPushSupported()) return;
    // 'granted' and 'denied' are both settled — re-asking is impossible in the
    // denied case and pointless in the granted one.
    if (pushPermission() !== 'default') return;

    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
      // One bar at a time. The cookie banner occupies this exact strip, and two
      // stacked full-width bars would cover the page between them.
      if (!localStorage.getItem('cookie_consent')) return;
    } catch {
      // Private mode or blocked storage: fall through and show it. Losing the
      // dismissal is better than never being able to offer notifications.
    }

    // Not the instant the page settles. Arriving mid-load reads as a pop-up and
    // gets dismissed reflexively, which would burn the browser prompt with it.
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, [userId]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // Nothing to do — the bar still closes for this session.
    }
    setShow(false);
  };

  const enable = async () => {
    setAsking(true);
    // Awaited inside the click handler so the gesture is still live when
    // Notification.requestPermission() runs.
    const result = await requestPushPermission();
    setAsking(false);
    setShow(false);

    if (result === 'granted') toast.success(t('enabled'));
    else if (result === 'denied') toast.info(t('blocked'));

    // Either way this is answered; do not raise it again.
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3 max-w-2xl">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-secondary">{t('title')}</p>
          <p className="text-sm text-muted">{t('message')}</p>
        </div>
      </div>
      <div className="flex gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={dismiss}
          className="px-4 py-2 border border-border rounded-full text-sm text-muted hover:border-secondary transition-colors"
        >
          {t('notNow')}
        </button>
        <button
          type="button"
          onClick={enable}
          disabled={asking}
          className="px-4 py-2 bg-primary text-white rounded-full text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {t('enable')}
        </button>
      </div>
    </div>
  );
}
