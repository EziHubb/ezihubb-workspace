import type { StateStorage } from 'zustand/middleware';

// Persistence is a convenience, not authority for identity/cart contents.
// If a browser refuses local storage, Zustand state remains in this document;
// authentication and cart data must still be restored from the server.
export const safeLocalStorage: StateStorage = {
  getItem: key => { try { return localStorage.getItem(key); } catch { return null; } },
  setItem: (key, value) => { try { localStorage.setItem(key, value); } catch { /* In-memory state remains usable. */ } },
  removeItem: key => { try { localStorage.removeItem(key); } catch { /* No persistence is available. */ } },
};
