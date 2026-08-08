import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { signOut } from 'next-auth/react';
import { setTokenGetter, setTokenUpdater, api } from '@ezihubb/api-client';
import { apiClient } from '@ezihubb/api-client';
import type { UserDto } from '@ezihubb/types';
import { API_ROUTES } from '@ezihubb/constants';

// ── In-memory access token ────────────────────────────────────────────────────
// The module-level var keeps the old api client's token getter working.
// The state field (accessToken) is excluded from persist — lost on reload.
// The httpOnly refresh-token cookie allows silent re-authentication.

let _accessToken: string | null = null;

// Wire in-memory token into every apiFetch() call (the old `api` client).
if (typeof window !== 'undefined') {
  setTokenGetter(() => _accessToken);
  setTokenUpdater((token) => {
    _accessToken = token ?? null;
    // Refresh failed — the backend session is dead. Clearing the Zustand
    // store alone isn't enough: next-auth's own session cookie has no idea
    // and still reports "authenticated" (its maxAge is independent of the
    // backend token's real lifetime), so SessionSyncer would just read the
    // same stale session.user.accessToken back into the store on its next
    // effect run, undoing this clear. Sign next-auth out too so status
    // actually flips to "unauthenticated" and account pages' auth guards
    // can redirect to /login instead of spinning forever.
    if (!token) {
      useAuthStore.setState({ user: null, accessToken: null });
      void signOut({ redirect: false });
    }
  });
}

// ── Lazy cart store accessor (avoids circular import) ─────────────────────────

function getCartStore() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./cart.store') as {
      useCartStore: {
        getState: () => {
          mergeGuestCart: () => Promise<void>;
          clearCart: () => void;
        };
      };
    };
    return mod.useCartStore.getState();
  } catch {
    return null;
  }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  email:         string;
  password:      string;
  firstName:     string;
  lastName:      string;
  referralCode?: string;
}

// ── Store interface ───────────────────────────────────────────────────────────

interface AuthStore {
  user: UserDto | null;
  accessToken: string | null; // in-memory only — NOT persisted
  isLoading: boolean;
  /** True after the first fetchCurrentUser() attempt completes (success or fail). */
  isAuthReady: boolean;

  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  setTokens: (accessToken: string, user: UserDto) => void;

  // ── Legacy aliases (kept for backward compat with existing consumers) ──────
  /** @deprecated use setTokens */
  setUser: (user: UserDto, accessToken: string) => void;
  clearAuth: () => void;
  getToken: () => string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function syncToken(token: string | null) {
  _accessToken = token;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthReady: false,

      // ── login ──────────────────────────────────────────────────────────────

      login: async (email, password, rememberMe = false) => {
        const res = await apiClient.post<{
          accessToken: string;
          user: UserDto;
        }>(API_ROUTES.AUTH.LOGIN, { email, password, rememberMe });

        const { accessToken, user } = res;
        syncToken(accessToken);
        set({ user, accessToken });

        // Merge guest cart into the authenticated cart (non-critical)
        try {
          await getCartStore()?.mergeGuestCart();
        } catch {
          /* non-fatal */
        }
      },

      // ── register ───────────────────────────────────────────────────────────

      register: async (dto) => {
        await apiClient.post(API_ROUTES.AUTH.REGISTER, dto);
        // No auto-login — user must verify email first
      },

      // ── logout ─────────────────────────────────────────────────────────────

      logout: async () => {
        const token = get().accessToken;
        try {
          await apiClient.post(
            API_ROUTES.AUTH.LOGOUT,
            {},
            {
              token: token ?? undefined,
            },
          );
        } catch {
          /* best-effort */
        }
        syncToken(null);
        set({ user: null, accessToken: null });
        getCartStore()?.clearCart();
      },

      // ── fetchCurrentUser ───────────────────────────────────────────────────

      fetchCurrentUser: async () => {
        set({ isLoading: true });
        let token = get().accessToken ?? _accessToken;

        if (!token) {
          // No in-memory token — attempt silent restore via httpOnly refresh cookie.
          const refreshed = await get().refreshToken();
          if (!refreshed) {
            set({ isLoading: false, isAuthReady: true });
            return;
          }
          // Refresh succeeded — pick up the newly stored token.
          token = get().accessToken ?? _accessToken;
        }

        if (!token) {
          set({ isLoading: false, isAuthReady: true });
          return;
        }

        try {
          const user = await apiClient.get<UserDto>(API_ROUTES.USERS.ME, { token });
          set({ user, isLoading: false, isAuthReady: true });
        } catch {
          syncToken(null);
          set({ user: null, accessToken: null, isLoading: false, isAuthReady: true });
        }
      },

      // ── refreshToken ───────────────────────────────────────────────────────
      // The /auth/refresh endpoint only returns { accessToken } — no user.
      // fetchCurrentUser() calls /me separately after a successful refresh.

      refreshToken: async () => {
        try {
          const res = await apiClient.post<{ accessToken: string }>(API_ROUTES.AUTH.REFRESH);
          syncToken(res.accessToken);
          set({ accessToken: res.accessToken });
          return true;
        } catch {
          syncToken(null);
          set({ user: null, accessToken: null });
          return false;
        }
      },

      // ── setTokens (Google OAuth callback + direct token injection) ─────────

      setTokens: (accessToken, user) => {
        syncToken(accessToken);
        set({ accessToken, user });
      },

      // ── Legacy aliases ─────────────────────────────────────────────────────

      setUser: (user, accessToken) => {
        syncToken(accessToken);
        set({ user, accessToken });
      },

      clearAuth: () => {
        syncToken(null);
        set({ user: null, accessToken: null });
      },

      getToken: () => _accessToken,
    }),

    {
      name: 'ezihubb-auth',
      // Only persist the user profile. accessToken and isAuthReady reset on every load.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
