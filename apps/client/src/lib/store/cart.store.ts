import { create } from 'zustand';

/**
 * Cart UI store — drawer open/close state only.
 *
 * All cart *data* (items, totals, coupon) lives in React Query via `useCart()`
 * from `@mlh/api-client`. This store manages purely ephemeral UI state that
 * does not need server synchronisation.
 */
interface CartUIStore {
  isDrawerOpen: boolean;
  openDrawer:   () => void;
  closeDrawer:  () => void;
}

export const useCartStore = create<CartUIStore>((set) => ({
  isDrawerOpen: false,
  openDrawer:   () => set({ isDrawerOpen: true }),
  closeDrawer:  () => set({ isDrawerOpen: false }),
}));
