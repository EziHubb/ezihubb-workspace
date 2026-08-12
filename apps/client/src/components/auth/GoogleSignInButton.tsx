'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import type { UserDto } from '@ezihubb/types';
import { API_ROUTES } from '@ezihubb/constants';
import { api } from '../../lib/api-client';
import { useAuthStore } from '../../lib/store/auth.store';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
  prompt: () => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

interface GoogleSignInButtonProps {
  /** Where to send the user after a successful sign-in. */
  redirectTo: string;
  onError?: (message: string) => void;
}

/**
 * Google Identity Services — renders the official "Sign in with Google"
 * button and triggers One Tap (the small account-chooser card that can pop
 * up automatically for a returning user), matching the UX of sites like
 * ITviec instead of a full-page/plain-popup OAuth redirect.
 *
 * The ID token Google hands back client-side is verified server-side by
 * POST /auth/google/token (see AuthService.googleTokenLogin) — there is no
 * redirect through the API at all in this flow.
 */
export function GoogleSignInButton({ redirectTo, onError }: GoogleSignInButtonProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const clientId = process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'];

  // GSI's callback is bound once inside initialize() below, which only runs
  // again if `clientId` changes — without refs, it would keep calling the
  // redirectTo/onError from whatever render first mounted this component,
  // even if the caller passes fresh ones later (e.g. a changed ?redirect=).
  const redirectToRef = useRef(redirectTo);
  redirectToRef.current = redirectTo;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      try {
        const result = await api.post<{ accessToken: string; user: UserDto }>(
          API_ROUTES.AUTH.GOOGLE_TOKEN,
          { credential: response.credential },
        );
        useAuthStore.getState().setTokens(result.accessToken, result.user);
        router.replace(redirectToRef.current);
      } catch {
        onErrorRef.current?.('Google sign-in failed. Please try again.');
      }
    };

    const init = () => {
      if (cancelled || !window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: buttonRef.current.offsetWidth || 360,
        text: 'continue_with',
      });
      window.google.accounts.id.prompt(); // One Tap
    };

    if (window.google) {
      init();
    } else {
      pollTimer = setInterval(() => {
        if (window.google) {
          clearInterval(pollTimer);
          init();
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      // Dismiss a still-open One Tap prompt so it doesn't linger after the
      // user navigates away from this page (e.g. login → register).
      window.google?.accounts.id.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div ref={buttonRef} className="w-full flex justify-center [&>div]:!w-full" />
    </>
  );
}
