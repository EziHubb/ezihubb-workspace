// Single source of truth for which of the 3 permission categories every
// admin route belongs to — see the "Platform vs. Shop-Owner Permission
// Boundary Redesign" plan for the full reasoning. Drives both route guards
// in `apps/admin/src/app/(admin)/layout.tsx` so the two lists can't drift
// apart again the way `superAdminOnly` and `STORE_ONLY_PREFIXES` did before
// this file existed.
//
//   PLATFORM_ONLY    — SUPER_ADMIN only, `inStoreMode` does NOT grant access.
//   SELF_SERVICE     — ADMIN's own store, or a SUPER_ADMIN switched into a
//                       store they own (`inStoreMode`). No platform-wide view.
//   SHARED_AGGREGATE — same page for both roles; not represented here since
//                       neither guard needs to block it (e.g. /orders,
//                       /products, /reviews, /stats, /dashboard, /stores).

export type RouteCategory = 'PLATFORM_ONLY' | 'SELF_SERVICE';

interface RouteCategoryEntry {
  prefix:   string;
  category: RouteCategory;
}

// Longest-prefix-match wins, so a more specific entry (e.g. '/settings/delivery')
// can override a broader one (e.g. '/settings') regardless of list order.
export const ROUTE_CATEGORIES: RouteCategoryEntry[] = [
  // ── PLATFORM_ONLY ─────────────────────────────────────────────────────────
  { prefix: '/catalog',             category: 'PLATFORM_ONLY' },
  { prefix: '/customers',           category: 'PLATFORM_ONLY' },
  { prefix: '/payments',            category: 'PLATFORM_ONLY' },
  { prefix: '/campaigns',           category: 'PLATFORM_ONLY' },
  { prefix: '/affiliates',          category: 'PLATFORM_ONLY' },
  { prefix: '/moderation',          category: 'PLATFORM_ONLY' },
  { prefix: '/finance',             category: 'PLATFORM_ONLY' },
  { prefix: '/payouts',             category: 'PLATFORM_ONLY' },
  { prefix: '/stores/plans',        category: 'PLATFORM_ONLY' },
  { prefix: '/stores/settings',     category: 'PLATFORM_ONLY' },
  { prefix: '/settings/audit-log',  category: 'PLATFORM_ONLY' },
  { prefix: '/settings/affiliates', category: 'PLATFORM_ONLY' },

  // ── SELF_SERVICE ──────────────────────────────────────────────────────────
  { prefix: '/settings/delivery',       category: 'SELF_SERVICE' },
  { prefix: '/marketing/offsite-ads',   category: 'SELF_SERVICE' },
  { prefix: '/marketing/social',        category: 'SELF_SERVICE' },
  { prefix: '/marketing/share-save',    category: 'SELF_SERVICE' },
  { prefix: '/finances',                category: 'SELF_SERVICE' },
  { prefix: '/policy-violations',       category: 'SELF_SERVICE' },
  { prefix: '/search-visibility',       category: 'SELF_SERVICE' },
  { prefix: '/customer-service-stats',  category: 'SELF_SERVICE' },
  { prefix: '/messages',                category: 'SELF_SERVICE' },
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

/** Longest matching prefix wins; returns null for SHARED_AGGREGATE / unlisted routes. */
export function categoryFor(pathname: string): RouteCategory | null {
  let best: RouteCategoryEntry | null = null;
  for (const entry of ROUTE_CATEGORIES) {
    if (!matches(pathname, entry.prefix)) continue;
    if (!best || entry.prefix.length > best.prefix.length) best = entry;
  }
  return best?.category ?? null;
}

export const PLATFORM_ONLY_PREFIXES = ROUTE_CATEGORIES
  .filter((e) => e.category === 'PLATFORM_ONLY')
  .map((e) => e.prefix);

export const SELF_SERVICE_PREFIXES = ROUTE_CATEGORIES
  .filter((e) => e.category === 'SELF_SERVICE')
  .map((e) => e.prefix);
