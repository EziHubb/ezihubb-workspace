/**
 * Centralized React Query key factory.
 *
 * Rules:
 *  - Every queryKey starts with a domain string so `invalidateQueries`
 *    can scope invalidation (e.g. invalidate ALL product queries).
 *  - Keys are typed `as const` so TypeScript can narrow them.
 *  - Prefix arrays are exported so callers can invalidate whole domains.
 */

// ── Domain prefixes (for broad invalidation) ──────────────────────────────────

export const PRODUCTS_KEY    = ['products']    as const;
export const CART_KEY        = ['cart']        as const;
export const ORDERS_KEY      = ['orders']      as const;
export const REVIEWS_KEY     = ['reviews']     as const;
export const WISHLIST_KEY    = ['wishlist']    as const;
export const CATEGORIES_KEY  = ['categories']  as const;
export const COLLECTIONS_KEY = ['collections'] as const;
export const SEARCH_KEY      = ['search']      as const;
export const PROFILE_KEY     = ['profile']     as const;
export const ADDRESSES_KEY   = ['addresses']   as const;
export const SHIPPING_KEY    = ['shipping']    as const;
export const MARKETPLACE_INSIGHTS_KEY = ['marketplace-insights'] as const;

// ── Fine-grained keys ─────────────────────────────────────────────────────────

export const queryKeys = {
  // Products
  products:       (q?: object)     => [...PRODUCTS_KEY, q ?? {}]          as const,
  product:        (slug: string)   => [...PRODUCTS_KEY, 'detail', slug]   as const,
  relatedProducts:(slug: string)   => [...PRODUCTS_KEY, 'related', slug]  as const,
  trendingProducts:()              => [...PRODUCTS_KEY, 'trending']       as const,

  // Cart (single entity — no params)
  cart:           ()               => CART_KEY,

  // Orders
  orders:         (q?: object)     => [...ORDERS_KEY, q ?? {}]            as const,
  order:          (num: string)    => [...ORDERS_KEY, 'detail', num]      as const,

  // Reviews
  reviews:        (slug: string, q?: object) => [...REVIEWS_KEY, slug, q ?? {}] as const,
  reviewSummary:  (slug: string)   => [...REVIEWS_KEY, slug, 'summary']  as const,

  // Wishlist
  wishlist:       ()               => WISHLIST_KEY,

  // Catalog
  categories:     (q?: object)     => [...CATEGORIES_KEY, q ?? {}]        as const,
  category:       (slug: string)   => [...CATEGORIES_KEY, 'detail', slug] as const,
  collections:    (q?: object)     => [...COLLECTIONS_KEY, q ?? {}]       as const,
  collection:     (slug: string)   => [...COLLECTIONS_KEY, 'detail', slug] as const,

  // Search
  search:         (q: object)      => [...SEARCH_KEY, q]                  as const,
  suggestions:    (q: string)      => [...SEARCH_KEY, 'suggestions', q]  as const,

  // User
  profile:        ()               => PROFILE_KEY,
  addresses:      ()               => ADDRESSES_KEY,

  // Shipping
  shippingEstimate:(country: string) => [...SHIPPING_KEY, 'estimate', country] as const,

  // Marketplace insights (seller keyword research)
  insightsTrending:  ()             => [...MARKETPLACE_INSIGHTS_KEY, 'trending'] as const,
  insightsTerm:      (term: string) => [...MARKETPLACE_INSIGHTS_KEY, 'term', term] as const,
  insightsAnalysis:  (term: string) => [...MARKETPLACE_INSIGHTS_KEY, 'analysis', term] as const,
  savedSearches:     ()             => [...MARKETPLACE_INSIGHTS_KEY, 'saved-searches'] as const,
  insightsQuota:     ()             => [...MARKETPLACE_INSIGHTS_KEY, 'quota'] as const,

  // New keys (aligned with query-keys.ts)
  megaMenu:       ()                   => ['mega-menu']                   as const,
  user:           ()                   => ['user']                        as const,
  autocomplete:   (q: string)          => ['autocomplete', q]             as const,
  trending:       ()                   => ['trending']                    as const,
  filterableAttrs:(slug: string)       => ['filterable-attrs', slug]      as const,
  shippingOptions:(country: string, total: number) =>
                    ['shipping', country, total]                          as const,

  // ── Admin keys ───────────────────────────────────────────────────────────────
  adminDashboard:  ()                   => ['admin', 'dashboard']            as const,
  adminOrders:     (q?: object)         => ['admin', 'orders', q ?? {}]      as const,
  adminOrder:      (id: string)         => ['admin', 'orders', 'detail', id] as const,
  adminProducts:   (q?: object)         => ['admin', 'products', q ?? {}]    as const,
  adminProduct:    (id: string)         => ['admin', 'products', 'detail', id] as const,
  adminCategories: ()                   => ['admin', 'categories']           as const,
  adminCollections:()                   => ['admin', 'collections']          as const,
  adminCustomers:  (q?: object)         => ['admin', 'customers', q ?? {}]   as const,
  adminReviews:    (q?: object)         => ['admin', 'reviews', q ?? {}]     as const,
  adminAffiliates: (q?: object)         => ['admin', 'affiliates', q ?? {}]  as const,
  adminAffiliate:  (id: string)         => ['admin', 'affiliates', 'detail', id] as const,
  adminMessages:   (q?: object)         => ['admin', 'messages', q ?? {}]    as const,
  adminShipping:   ()                   => ['admin', 'shipping']             as const,
  adminPromotions: ()                   => ['admin', 'promotions']           as const,
  adminPayments:   (q?: object)         => ['admin', 'payments', q ?? {}]    as const,
} as const;

// ── Backward-compat re-exports (used by existing hooks) ──────────────────────

/** @deprecated Use queryKeys.cart() */
export const CART_QUERY_KEY    = CART_KEY;
/** @deprecated Use queryKeys.wishlist() */
export const WISHLIST_QUERY_KEY = WISHLIST_KEY;
