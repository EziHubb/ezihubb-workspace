import { NextResponse } from 'next/server';

// Dynamic route that serves the Firebase Messaging service worker with env vars injected.
// Registered as /firebase-messaging-sw.js so FCM can find it at the root scope.
export async function GET() {
  const config = JSON.stringify({
    apiKey:            process.env['NEXT_PUBLIC_FIREBASE_API_KEY']            ?? '',
    authDomain:        process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']        ?? '',
    projectId:         process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']         ?? '',
    messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ?? '',
    appId:             process.env['NEXT_PUBLIC_FIREBASE_APP_ID']             ?? '',
  });

  const content = `
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp(${config});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'EziHubb', {
    body:    body ?? '',
    icon:    '/icons/icon-192x192.png',
    badge:   '/icons/badge-72x72.png',
    data:    payload.data,
    actions: [{ action: 'open', title: 'View' }],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickAction = event.notification.data?.clickAction ?? '/';
  clients.openWindow(clickAction);
});
`.trim();

  return new NextResponse(content, {
    headers: {
      'Content-Type':          'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control':         'no-store',
    },
  });
}
