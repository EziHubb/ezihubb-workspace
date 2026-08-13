'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import type { UserDto } from '@ezihubb/types';
import { API_ROUTES } from '@ezihubb/constants';
import { api } from '../../lib/api-client';

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
 * redirect through the API at all in this flow. The resulting accessToken
 * is then handed to next-auth's 'google-token' provider (auth.options.ts)
 * so the rest of the app's session-based auth guards recognize the user as
 * signed in.
 */
export function GoogleSignInButton({ redirectTo, onError }: GoogleSignInButtonProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const clientId = process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'];

  // Covers the gap between "Google handed us a credential" and the redirect
  // actually landing — verifying it and establishing the session both need a
  // round trip, and without this the One Tap card just closes with no other
  // feedback, which reads as "did that even work?" on a slow connection.
  const [isLoading, setIsLoading] = useState(false);

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
      setIsLoading(true);
      try {
        const result = await api.post<{ accessToken: string; user: UserDto }>(
          API_ROUTES.AUTH.GOOGLE_TOKEN,
          { credential: response.credential },
        );
        // Wrap the already-verified token in a next-auth session (rather than
        // writing straight to the Zustand store) — useSession()-based guards
        // like AccountLayoutClient check next-auth's status, not Zustand, so
        // skipping this left every Google sign-in bounced right back to
        // /login even though the API call itself had succeeded.
        const signInResult = await signIn('google-token', {
          redirect:    false,
          accessToken: result.accessToken,
          user:        JSON.stringify(result.user),
        });
        if (!signInResult?.ok) {
          setIsLoading(false);
          onErrorRef.current?.('Google sign-in failed. Please try again.');
          return;
        }
        // Left true on purpose — the redirect below is about to unmount this
        // page, so there's no render left where resetting it would matter,
        // and keeping the overlay up avoids a one-frame flash of the bare
        // button right before navigation completes.
        router.replace(redirectToRef.current);
      } catch {
        setIsLoading(false);
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
      <div className="relative">
        <div ref={buttonRef} className="w-full flex justify-center [&>div]:!w-full" />
        {isLoading && (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-button"
          >
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </>
  );
}
