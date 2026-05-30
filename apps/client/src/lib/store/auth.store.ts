import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setTokenGetter, setTokenUpdater, api } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import type { UserDto } from '@mlh/types';

// ── In-memory access token ────────────────────────────────────────────────────
//
// Intentionally NOT stored in Zustand state (which would persist it).
// Lives only in JS heap — cleared automatically on page refresh.
// The httpOnly refresh-token cookie allows silent re-authentication.

let _accessToken: string | null = null;

// ── Register token provider with shared API client ───────────────────────────
//
// This runs immediately when the module is first imported, wiring the
// in-memory token into every apiFetch() call throughout the app.

if (typeof window !== 'undefined') {
  setTokenGetter(() => _accessToken);
  setTokenUpdater((token) => { _accessToken = token ?? null; });
}

// ── Store interface ───────────────────────────────────────────────────────────

interface AuthStore {
  /** Persisted to localStorage — safe to expose (no sensitive fields). */
  user:      UserDto | null;
  isLoading: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────────

  /** Called after a successful login / OAuth callback. */
  setUser: (user: UserDto, accessToken: string) => void;

  /** Clear auth state without hitting the API (used after API-logout completes). */
  clearAuth: () => void;

  /** Sign out: revoke the refresh token on the server, then clear local state. */
  logout: () => Promise<void>;

  /**
   * Silently refresh the access token using the httpOnly refresh cookie.
   * Called automatically by client.ts on 401; also called on app boot.
   * Returns the new token or null if refresh fails.
   */
  refreshToken: () => Promise<string | null>;

  /**
   * Fetch the current user's profile and populate the store.
   * Triggers a silent refresh first if no token is in memory.
   */
  fetchCurrentUser: () => Promise<void>;

  /** Synchronous getter for the in-memory access token. */
  getToken: () => string | null;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:      null,
      isLoading: false,

      setUser: (user, accessToken) => {
        _accessToken = accessToken;
        set({ user });
      },

      clearAuth: () => {
        _accessToken = null;
        set({ user: null });
      },

      logout: async () => {
        // Best-effort server-side token revocation
        try {
          const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
          await fetch(`${base}/api/v1${API_ROUTES.AUTH.LOGOUT}`, {
            method:      'POST',
            credentials: 'include',
          });
        } catch {
          // Proceed even if the request fails (e.g. offline)
        }
        _accessToken = null;
        set({ user: null });
      },

      refreshToken: async () => {
        try {
          const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
          const res  = await fetch(`${base}/api/v1${API_ROUTES.AUTH.REFRESH}`, {
            method:      'POST',
            credentials: 'include', // sends httpOnly refresh-token cookie
          });

          if (!res.ok) {
            _accessToken = null;
            set({ user: null });
            return null;
          }

          const body = await res.json();
          const token: string | null = body?.data?.accessToken ?? null;

          if (token) {
            _accessToken = token;
            const user = body?.data?.user as UserDto | undefined;
            if (user) set({ user });
          }

          return token;
        } catch {
          return null;
        }
      },

      fetchCurrentUser: async () => {
        // Ensure we have a valid token first
        if (!_accessToken) {
          const token = await get().refreshToken();
          if (!token) return; // Not authenticated
        }

        set({ isLoading: true });
        try {
          const user = await api.get<UserDto>(API_ROUTES.USERS.ME);
          set({ user, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      getToken: () => _accessToken,
    }),

    {
      name:       'mlh-auth',
      // Only persist the user object — never the access token.
      // The access token is always re-acquired from the refresh cookie.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
