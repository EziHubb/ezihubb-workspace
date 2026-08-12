import type { UserDto } from '@ezihubb/types';

export const GOOGLE_OAUTH_MESSAGE_TYPE = 'ezihubb:google-oauth-result';

interface GoogleOAuthSuccessMessage {
  type:  typeof GOOGLE_OAUTH_MESSAGE_TYPE;
  token: string;
  user:  UserDto;
}

interface GoogleOAuthErrorMessage {
  type:  typeof GOOGLE_OAUTH_MESSAGE_TYPE;
  error: string;
}

type GoogleOAuthMessage = GoogleOAuthSuccessMessage | GoogleOAuthErrorMessage;

/**
 * Called from the legacy OAuth 2.0 redirect callback page
 * (auth/google/callback) to hand the result back to the window that opened
 * it, then close itself, when that page happens to be running inside a
 * popup. The primary sign-in UI uses Google Identity Services instead (see
 * GoogleSignInButton), which never redirects at all — this only matters if
 * something still links directly to the legacy /auth/google redirect.
 * Returns false when there's no opener, so the caller can fall back to
 * handling the result directly instead of silently doing nothing.
 */
export function postGoogleOAuthResultToOpener(message: GoogleOAuthMessage): boolean {
  if (typeof window === 'undefined' || !window.opener || window.opener === window) return false;
  window.opener.postMessage(message, window.location.origin);
  window.close();
  return true;
}
