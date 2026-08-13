/**
 * Last-touch search attribution — "which search term brought this buyer to a
 * product they later add to cart", stored client-side since a buyer often
 * browses a while before adding to cart. A single global "most recent search
 * click" (not per-product) is a deliberate simplification: if someone
 * searches, views product A, then adds product B instead, the search still
 * gets credit — that matches how most last-touch attribution works and
 * avoids needing a productId-keyed map.
 */

const STORAGE_KEY = 'ezihubb_search_attr';
const TTL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days

interface StoredAttribution {
  term: string;
  timestamp: number;
}

export function saveSearchAttribution(term: string): void {
  if (typeof window === 'undefined' || !term) return;
  try {
    const payload: StoredAttribution = { term, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — non-critical
  }
}

export function readSearchAttribution(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const { term, timestamp } = JSON.parse(raw) as StoredAttribution;
    if (!term || Date.now() - timestamp > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return term;
  } catch {
    return undefined;
  }
}
