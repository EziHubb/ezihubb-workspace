import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { api } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';

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
 * Whether this browser can receive push at all.
 *
 * Notably false in an iOS Safari tab: iOS exposes window.Notification only to a
 * site the user has added to the Home Screen, so on iPhone this stays false
 * until the app is installed. Callers should treat it as "do not ask", not as
 * an error.
 */
export function isPushSupported(): boolean {
  return (
    isConfigured() &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

/** 'default' means the browser has not been asked yet. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

/**
 * Mint an FCM token for the signed-in user and hand it to the API.
 *
 * Never prompts — it returns false unless permission is ALREADY granted, which
 * is what makes it safe to call on page load. Asking is requestPushPermission's
 * job, and only from a click.
 */
export async function syncPushToken(): Promise<boolean> {
  if (pushPermission() !== 'granted') return false;

  try {
    // Idempotent: ServiceWorkerRegistrar already registers this exact script
    // and scope for every visitor, and register() returns the existing
    // registration rather than creating a second one. Used here rather than
    // navigator.serviceWorker.ready, which never resolves at all if that
    // registration failed.
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' },
    );

    const messaging = getMsg();
    if (!messaging) return false;

    const token = await getToken(messaging, {
      vapidKey:                  process.env['NEXT_PUBLIC_FIREBASE_VAPID_KEY'],
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    await api.post(API_ROUTES.USERS.FCM_TOKEN, { token, platform: 'web' });
    return true;
  } catch {
    // Push is optional and must never break the page that called this.
    return false;
  }
}

/**
 * Ask the browser for notification permission, then register the token.
 *
 * MUST be called from a user gesture. This used to run automatically on login,
 * which cost us twice: Chrome demotes an ungestured request to its quiet UI and
 * can block the origin permanently, and Safari refuses outright — so on iOS the
 * dialog never appeared at all. The in-app prompt that calls this is what earns
 * the gesture, and it also means a user who says no here is never reported to
 * the browser as a denial we can't undo.
 */
export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') await syncPushToken();
    return permission;
  } catch {
    return 'denied';
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
