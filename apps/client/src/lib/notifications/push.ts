import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            process.env['NEXT_PUBLIC_FIREBASE_API_KEY'],
  authDomain:        process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
  projectId:         process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
  messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
  appId:             process.env['NEXT_PUBLIC_FIREBASE_APP_ID'],
};

function isConfigured(): boolean {
  return typeof window !== 'undefined' && !!process.env['NEXT_PUBLIC_FIREBASE_API_KEY'];
}

function getApp(): FirebaseApp | null {
  if (!isConfigured()) return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

function getMsg(): Messaging | null {
  const app = getApp();
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}

/**
 * Request push permission and return an FCM token, or null if unavailable.
 * Safe to call multiple times — reuses existing token if already granted.
 */
export async function initPushNotifications(): Promise<string | null> {
  if (!isConfigured()) return null;
  if (!('Notification' in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // Idempotent: ServiceWorkerRegistrar already registers this exact script
    // and scope for every visitor, and register() returns the existing
    // registration rather than creating a second one. Kept here rather than
    // awaiting navigator.serviceWorker.ready, which never resolves at all if
    // that registration failed.
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' },
    );

    const messaging = getMsg();
    if (!messaging) return null;

    const token = await getToken(messaging, {
      vapidKey:                process.env['NEXT_PUBLIC_FIREBASE_VAPID_KEY'],
      serviceWorkerRegistration: registration,
    });

    return token ?? null;
  } catch {
    return null;
  }
}

/**
 * Listen for foreground messages (when the tab is open).
 * Call the provided callback to show an in-app notification.
 */
export function setupForegroundMessages(
  onNotification: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void,
): () => void {
  const messaging = getMsg();
  if (!messaging) return () => undefined;

  const unsubscribe = onMessage(messaging, (payload) => {
    const title = payload.notification?.title;
    const body  = payload.notification?.body;
    const data  = payload.data as Record<string, string> | undefined;
    onNotification({ title, body, data });
  });

  return unsubscribe;
}
