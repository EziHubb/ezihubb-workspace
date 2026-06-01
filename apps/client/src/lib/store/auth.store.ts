import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setTokenGetter, setTokenUpdater, api } from '@mlh/api-client';
import { apiClient } from '@mlh/api-client';
import type { UserDto } from '@mlh/types';

// ── In-memory access token ────────────────────────────────────────────────────
// The module-level var keeps the old api client's token getter working.
// The state field (accessToken) is excluded from persist — lost on reload.
// The httpOnly refresh-token cookie allows silent re-authentication.

let _accessToken: string | null = null;

// Wire in-memory token into every apiFetch() call (the old `api` client).
if (typeof window !== 'undefined') {
  setTokenGetter(() => _accessToken);
  setTokenUpdater((token) => { _accessToken = token ?? null; });
}

// ── Lazy cart store accessor (avoids circular import) ─────────────────────────

function getCartStore() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./cart.store') as {
      useCartStore: { getState: () => { mergeGuestCart: () => Promise<void>; clearCart: () => void } };
    };
    return mod.useCartStore.getState();
  } catch {
    return null;
  }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
}

// ── Store interface ───────────────────────────────────────────────────────────

interface AuthStore {
  user:        UserDto | null;
  accessToken: string | null;  // in-memory only — NOT persisted
  isLoading:   boolean;

  login:            (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register:         (dto: RegisterDto) => Promise<void>;
  logout:           () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  refreshToken:     () => Promise<boolean>;
  setTokens:        (accessToken: string, user: UserDto) => void;

  // ── Legacy aliases (kept for backward compat with existing consumers) ──────
  /** @deprecated use setTokens */
  setUser:   (user: UserDto, accessToken: string) => void;
  clearAuth: () => void;
  getToken:  () => string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function syncToken(token: string | null) {
  _accessToken = token;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      isLoading:   false,

      // ── login ──────────────────────────────────────────────────────────────

      login: async (email, password, rememberMe = false) => {
        const res = await apiClient.post<{
          accessToken: string;
          user: UserDto;
        }>('/auth/login', { email, password, rememberMe });

        const { accessToken, user } = res;
        syncToken(accessToken);
        set({ user, accessToken });

        // Merge guest cart into the authenticated cart (non-critical)
        try {
          await getCartStore()?.mergeGuestCart();
        } catch { /* non-fatal */ }
      },

      // ── register ───────────────────────────────────────────────────────────

      register: async (dto) => {
        await apiClient.post('/auth/register', dto);
        // No auto-login — user must verify email first
      },

      // ── logout ─────────────────────────────────────────────────────────────

      logout: async () => {
        const token = get().accessToken;
        try {
          await apiClient.post('/auth/logout', {}, {
            token: token ?? undefined,
          });
        } catch { /* best-effort */ }
        syncToken(null);
        set({ user: null, accessToken: null });
        getCartStore()?.clearCart();
      },

      // ── fetchCurrentUser ───────────────────────────────────────────────────

      fetchCurrentUser: async () => {
        const token = get().accessToken ?? _accessToken;
        if (!token) return;
        set({ isLoading: true });
        try {
          const user = await apiClient.get<UserDto>('/users/me', { token });
          set({ user, isLoading: false });
        } catch {
          syncToken(null);
          set({ user: null, accessToken: null, isLoading: false });
        }
      },

      // ── refreshToken ───────────────────────────────────────────────────────

      refreshToken: async () => {
        try {
          const res = await apiClient.post<{
            accessToken: string;
            user: UserDto;
          }>('/auth/refresh');
          syncToken(res.accessToken);
          set({ accessToken: res.accessToken, user: res.user });
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
      name: 'mlh-auth',
      // Never persist the access token — re-acquired from the httpOnly refresh cookie.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
