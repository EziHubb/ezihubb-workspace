'use client';

import { useEffect } from 'react';

/**
 * Registers the app's single service worker for every visitor.
 *
 * This used to happen only inside the push bootstrap, which ran after login
 * and only once notification permission was granted — so a signed-out visitor
 * had no worker at all, and Chrome will not offer to install an app
 * whose scope has no worker with a fetch handler. Installability has nothing
 * to do with being logged in, so registration cannot hang off auth.
 *
 * The worker itself is idempotent to register: same script URL and scope
 * returns the existing registration rather than creating a second one, so it
 * is safe that push.ts also awaits it.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // After load, not during: the worker fetches and precaches, and there is
    // no reason for that to compete with the page the user is waiting on.
    const register = () => {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js', { scope: '/' })
        .catch(() => {
          // Registration fails on unsupported or hardened browsers, and in
          // private windows. Offline support and install are optional; the
          // site works without them.
        });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
