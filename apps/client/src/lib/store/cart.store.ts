import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@ezihubb/api-client';
import type { CartDto, CartItemDto, CartTotals } from '@ezihubb/types';
import { API_ROUTES } from '@ezihubb/constants';
import { analytics } from '../analytics';

// ── Helper: read auth token without circular import ───────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Dynamic require avoids circular-dep issues at module init time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('./auth.store') as {
      useAuthStore: { getState: () => { getToken: () => string | null } };
    };
    return useAuthStore.getState().getToken();
  } catch {
    return null;
  }
}

// ── Helper: session header for guest requests ─────────────────────────────────

function sessionHeader(sessionId: string | null): Record<string, string> {
  if (getToken() || !sessionId) return {};
  return { 'X-Session-ID': sessionId };
}

// ── Normalise: ensure flat fields exist regardless of API response shape ──────

function normalizeItem(item: CartItemDto): CartItemDto {
  return {
    ...item,
    productName: item.productName || item.product?.name || '',
    productSlug: item.productSlug || item.product?.slug || '',
    productImageUrl:
      item.productImageUrl !== undefined
        ? item.productImageUrl
        : (item.product?.images?.[0]?.url ?? null),
    variantName:
      item.variantName !== undefined
        ? item.variantName
        : item.variant
          ? Object.values(item.variant.options).join(' / ')
          : null,
    variantOptions:
      item.variantOptions !== undefined
        ? item.variantOptions
        : (item.variant?.options ?? null),
    priceChanged:
      item.priceChanged !== undefined
        ? item.priceChanged
        : item.unitPrice !== item.currentPrice,
    totalPrice: item.totalPrice ?? item.currentPrice * item.quantity,
  };
}

function normalizeCart(cart: CartDto): CartDto {
  const items = cart.items.map(normalizeItem);
  const itemCount = cart.itemCount ?? items.reduce((s, i) => s + i.quantity, 0);
  const subtotal =
    cart.subtotal ?? items.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
  const discount = cart.discountAmount ?? 0;

  const totals: CartTotals = cart.totals ?? {
    subtotal,
    discount,
    shipping: 0,
    total: Math.max(0, subtotal - discount),
    itemCount,
  };

  return {
    ...cart,
    items,
    itemCount,
    subtotal,
    discountAmount: discount,
    totals,
  };
}

// ── Add-item DTO ──────────────────────────────────────────────────────────────

export interface AddItemDto {
  productId: string;
  variantId?: string | null;
  quantity: number;
  customizationData?: unknown;
  previewUrl?: string | null;
}

// ── Store interface ───────────────────────────────────────────────────────────

interface CartStore {
  // ── Cart data ──────────────────────────────────────────────────────────────
  cart: CartDto | null;
  sessionId: string | null;
  isLoading: boolean;
  _lastMutatedAt: number;

  // ── Drawer UI (kept for backward compat — Navbar/CartDrawer use these) ─────
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  // ── Actions ────────────────────────────────────────────────────────────────
  initSession: () => void;
  fetchCart: () => Promise<void>;
  addItem: (dto: AddItemDto) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  mergeGuestCart: () => Promise<void>;
  clearCart: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      cart: null,
      sessionId: null,
      isLoading: false,
      isDrawerOpen: false,
      _lastMutatedAt: 0,

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),

      initSession: () => {
        if (!get().sessionId) {
          set({ sessionId: crypto.randomUUID() });
        }
      },

      fetchCart: async () => {
        // Skip fetch if a mutation just ran — prevents GET from overwriting addItem's response
        if (Date.now() - get()._lastMutatedAt < 2000) return;
        set({ isLoading: true });
        try {
          const res = await apiClient.get<CartDto>(API_ROUTES.CART.GET, {
            headers: sessionHeader(get().sessionId),
          });
          set({ cart: normalizeCart(res), isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      addItem: async (dto) => {
        const prevCart = get().cart;
        try {
          const res = await apiClient.post<CartDto>(API_ROUTES.CART.ADD, dto, {
            headers: sessionHeader(get().sessionId),
          });
          set({ cart: normalizeCart(res), _lastMutatedAt: Date.now() });
          const addedItem = res.items.find(
            (i) => i.productId === dto.productId,
          );
          if (addedItem) {
            analytics.addToCart({
              id: dto.productId,
              name: addedItem.productName,
              category: '',
              price: Number(addedItem.currentPrice),
              quantity: dto.quantity,
              variantId: dto.variantId ?? undefined,
            });
          }
        } catch (err) {
          set({ cart: prevCart });
          throw err;
        }
      },

      updateItem: async (itemId, quantity) => {
        // Optimistic update
        const prevCart = get().cart;
        if (prevCart) {
          set({
            cart: normalizeCart({
              ...prevCart,
              items: prevCart.items.map((i) =>
                i.id === itemId ? { ...i, quantity } : i,
              ),
            }),
          });
        }
        try {
          const res = await apiClient.patch<CartDto>(
            API_ROUTES.CART.UPDATE_ITEM(itemId),
            { quantity },
            { headers: sessionHeader(get().sessionId) },
          );
          set({ cart: normalizeCart(res) });
        } catch (err) {
          set({ cart: prevCart });
          throw err;
        }
      },

      removeItem: async (itemId) => {
        const prevCart = get().cart;
        if (prevCart) {
          set({
            cart: normalizeCart({
              ...prevCart,
              items: prevCart.items.filter((i) => i.id !== itemId),
            }),
          });
        }
        try {
          const res = await apiClient.delete<CartDto>(
            API_ROUTES.CART.REMOVE_ITEM(itemId),
            { headers: sessionHeader(get().sessionId) },
          );
          set({ cart: normalizeCart(res) });
        } catch (err) {
          set({ cart: prevCart });
          throw err;
        }
      },

      applyCoupon: async (code) => {
        const res = await apiClient.post<CartDto>(
          API_ROUTES.CART.COUPON,
          { code },
          { headers: sessionHeader(get().sessionId) },
        );
        set({ cart: normalizeCart(res) });
      },

      removeCoupon: async () => {
        const res = await apiClient.delete<CartDto>(API_ROUTES.CART.COUPON, {
          headers: sessionHeader(get().sessionId),
        });
        set({ cart: normalizeCart(res) });
      },

      mergeGuestCart: async () => {
        const sessionId = get().sessionId;
        if (!sessionId || !getToken()) return;
        try {
          const res = await apiClient.post<CartDto>(API_ROUTES.CART.MERGE, {
            sessionId,
          });
          set({ cart: normalizeCart(res), sessionId: null });
        } catch {
          // Merge failure is non-fatal — user keeps their logged-in cart
        }
      },

      clearCart: () => set({ cart: null }),
    }),
    {
      name: 'ezihubb-cart',
      // Only persist sessionId — cart data is always fetched fresh from server
      partialize: (state) => ({ sessionId: state.sessionId }),
    },
  ),
);
