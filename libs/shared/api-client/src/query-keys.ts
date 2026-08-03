/**
 * Canonical React Query key factory.
 *
 * Import directly from this file when you need the new key shapes:
 *   import { queryKeys } from '@ezihubb/api-client/query-keys'
 *
 * The legacy key factory in queryKeys.ts is kept for backward compat
 * with existing hooks. New feature hooks should use this file.
 */
export const queryKeys = {
  megaMenu:        ['mega-menu']                                           as const,
  categories:      (filters?: object) => ['categories', filters]          as const,
  category:        (slug: string)     => ['category', slug]               as const,
  collections:     (filters?: object) => ['collections', filters]         as const,
  collection:      (slug: string)     => ['collection', slug]             as const,
  products:        (filters?: object) => ['products', filters]            as const,
  product:         (slug: string)     => ['product', slug]                as const,
  productReviews:  (slug: string, page?: number) =>
                     ['product-reviews', slug, page]                      as const,
  reviewSummary:   (slug: string)     => ['review-summary', slug]         as const,
  cart:            ['cart']                                               as const,
  orders:          (filters?: object) => ['orders', filters]              as const,
  order:           (orderNumber: string) => ['order', orderNumber]        as const,
  wishlist:        ['wishlist']                                           as const,
  addresses:       ['addresses']                                          as const,
  user:            ['user']                                               as const,
  search:          (q: string, filters?: object) =>
                     ['search', q, filters]                               as const,
  autocomplete:    (q: string)        => ['autocomplete', q]              as const,
  trending:        ['trending']                                           as const,
  shippingOptions: (country: string, total: number) =>
                     ['shipping', country, total]                         as const,
  filterableAttrs: (categorySlug: string) =>
                     ['filterable-attrs', categorySlug]                   as const,
} as const;
