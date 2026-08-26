import { NextResponse } from 'next/server';

/**
 * The app's ONLY service worker.
 *
 * It does two jobs that would otherwise want two workers: Firebase Cloud
 * Messaging, and the offline shell that makes the site installable. They are
 * merged deliberately — a browser keeps one active registration per scope, so
 * a second worker registered at '/' would silently displace this one and take
 * push down with it.
 *
 * Kept at this exact filename because that is where FCM looks by default; the
 * client also passes this registration to getToken() explicitly, so there is
 * never a second, auto-registered copy.
 *
 * Served from a route rather than public/ so the Firebase config can be
 * injected, and with no-store so a stale worker cannot pin users to an old
 * build (browsers cap service-worker script caching at 24h otherwise).
 */
export async function GET() {
  const config = JSON.stringify({
    apiKey:            process.env['NEXT_PUBLIC_FIREBASE_API_KEY']            ?? '',
    authDomain:        process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']        ?? '',
    projectId:         process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']         ?? '',
    messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ?? '',
    appId:             process.env['NEXT_PUBLIC_FIREBASE_APP_ID']             ?? '',
  });

  const content = `
// ---------------------------------------------------------------------------
// Offline shell. Deliberately first, and deliberately independent of Firebase:
// everything below this block is allowed to fail without taking installability
// with it.
// ---------------------------------------------------------------------------

const CACHE_NAME  = 'ezihubb-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE    = [OFFLINE_URL, '/android-chrome-192x192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(
      // Per item, and each failure swallowed. addAll() rejects the whole
      // batch if any single entry 404s, which would reject install, leave
      // the worker unactivated, and cost us the install prompt and push as
      // well as the offline page. A missing entry should cost only itself.
      // cache: reload so a stale CDN copy is never what gets frozen here.
      PRECACHE.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
      )
    ))
  );
  // Take over on the next load instead of waiting for every tab to close.
  // Without this a broken worker can pin users to it for days.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        // Only our own generations. The unfiltered version deleted every
        // Cache Storage entry on the origin, including any a library or a
        // future feature had put there.
        keys
          .filter((k) => k.startsWith('ezihubb-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only top-level page loads are intercepted, and even those are network
  // first. Nothing else is touched at all — no respondWith means the browser
  // handles the request exactly as it would with no worker installed.
  //
  // This is a storefront: prices, stock and running sales change under us. A
  // worker that cached HTML or /api responses would serve an expired sale
  // price from the user's own disk, where we cannot clear it. Precaching the
  // hashed /_next/static chunks would be worse still — a chunk set from one
  // build paired with HTML from the next is a ChunkLoadError.
  //
  // Navigations include form POSTs, and answering a failed POST with a 200
  // offline page reads as "submitted" to the browser. Only GET is ours.
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error())
    )
  );
});


// ---------------------------------------------------------------------------
// Push. Guarded twice over, because a throw at worker top level aborts
// installation — which would mean a Firebase outage or a blank config also
// costs us the offline shell and the install prompt above.
// ---------------------------------------------------------------------------

const FIREBASE_CONFIG = ${config};

try {
  if (FIREBASE_CONFIG.apiKey) {
    importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

    firebase.initializeApp(FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      self.registration.showNotification(notification.title || 'EziHubb', {
        body: notification.body || '',
        // /icons/ never existed. Worse than a 404: the path has no dot in its
        // first segment, so middleware answers 307 to a locale prefix and the
        // notification quietly falls back to the browser's own icon.
        icon: '/android-chrome-192x192.png',
        // Android reads only this file's alpha channel and tints the result
        // itself, so it has to be a silhouette. Handing it the full-colour
        // icon instead renders a grey blob.
        badge: '/badge-72x72.png',
        data: payload.data,
        actions: [{ action: 'open', title: 'View' }],
      });
    });
  }
} catch (err) {
  // Push is off for this session; the offline shell above still works.
  // Logged rather than swallowed: without this, "notifications stopped
  // working" has no trace anywhere to start from.
  console.warn('[sw] push init failed:', err);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.clickAction) || '/';

  // Focus a tab we already have rather than stacking up new windows, and wrap
  // it in waitUntil — the previous version called openWindow bare, so the
  // worker could be killed before the window ever opened.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          // navigate() rejects on a client this worker does not control,
          // and an unhandled rejection here loses the focus() below with it.
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
`.trim();

  return new NextResponse(content, {
    headers: {
      'Content-Type':           'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control':          'no-store',
    },
  });
}
