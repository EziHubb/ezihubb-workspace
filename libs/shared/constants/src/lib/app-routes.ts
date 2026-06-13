// ── Admin app routes (apps/admin — locale-less, rooted at /) ─────────────────

export const ADMIN_ROUTES = {
  LOGIN:         '/login',
  TOTP_VERIFY:   '/totp-verify',
  TOTP_SETUP:    '/totp-setup',

  DASHBOARD:     '/dashboard',

  ORDERS:        '/orders',
  ORDER:         (id: string) => `/orders/${id}`,

  PRODUCTS:      '/products',
  PRODUCT_NEW:   '/products/new',
  PRODUCT_EDIT:  (id: string) => `/products/${id}/edit`,
  PRODUCT_COPY:  (id: string) => `/products/copy/${id}`,
  PRODUCTS_SEO:  '/products/seo',
  PRODUCTS_IMPORT: '/products/import',

  CATALOG:            '/catalog',
  CATALOG_CATEGORIES: '/catalog/categories',
  CATALOG_COLLECTIONS: '/catalog/collections',

  CUSTOMERS:     '/customers',
  CUSTOMER:      (id: string) => `/customers/${id}`,

  MESSAGES:      '/messages',
  MESSAGES_ORDER: (orderId: string) => `/messages?orderId=${orderId}`,

  PROMOTIONS:    '/promotions',

  REVIEWS:       '/reviews',

  SHIPPING:      '/shipping',

  PAYMENTS:      '/payments',

  AFFILIATES:    '/affiliates',
  AFFILIATE:     (id: string) => `/affiliates/${id}`,
  AFFILIATES_PAYOUTS: '/affiliates/payouts',

  CREATORS_ADMIN:          '/creators',
  CREATORS_ADMIN_MEMBERS:  '/creators/members',
  CREATORS_ADMIN_PAYOUTS:  '/creators/payouts',
  CREATORS_ADMIN_SETTINGS: '/creators/settings',

  MODERATION:       '/moderation',
  MODERATION_QUEUE: '/moderation/queue',

  FINANCE: '/finance',

  STORES: '/stores',
  STORE:  (id: string) => `/stores/${id}`,

  ai: {
    trends:      '/ai/trends',
    pricing:     '/ai/pricing',
    creatorDna:  '/ai/creator-dna',
    usage:       '/ai/usage',
    settings:    '/ai/settings',
  },

  STATS:          '/stats',
  STATS_LISTINGS: '/stats/listings',
  STATS_LISTING:  (id: string) => `/stats/listings/${id}`,
} as const;

// ── Client app routes (apps/client — without /${locale} prefix) ───────────────

export const CLIENT_ROUTES = {
  HOME:     '/',
  PRODUCTS: '/products',
  PRODUCT:  (slug: string) => `/products/${slug}`,
  PRODUCT_CUSTOMIZE: (slug: string) => `/products/${slug}/customize`,

  SHOP:     (slug: string) => `/shops/${slug}`,

  CATEGORIES:  '/categories',
  CATEGORY:    (slug: string) => `/categories/${slug}`,

  COLLECTIONS: '/collections',
  COLLECTION:  (slug: string) => `/collections/${slug}`,

  OCCASIONS:   '/occasions',
  OCCASION:    (slug: string) => `/occasions/${slug}`,

  CART:        '/cart',
  CHECKOUT:    '/checkout',
  CHECKOUT_SUCCESS: (orderNumber: string) => `/checkout/success?order=${orderNumber}`,

  SEARCH:      '/search',

  ORDERS_TRACK: '/orders/track',

  GIFT_CARDS:  '/gift-cards',

  WISHLIST_SHARED: (token: string) => `/wishlist/${token}`,

  LOGIN:           '/login',
  REGISTER:        '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD:  '/reset-password',
  LOGIN_REDIRECT:  (redirect: string) => `/login?redirect=${encodeURIComponent(redirect)}`,

  ACCOUNT:         '/account',
  ACCOUNT_PROFILE: '/account/profile',
  ACCOUNT_ORDERS:  '/account/orders',
  ACCOUNT_ORDER:   (orderNumber: string) => `/account/orders/${orderNumber}`,
  ACCOUNT_WISHLIST: '/account/wishlist',
  ACCOUNT_ADDRESSES: '/account/addresses',
  ACCOUNT_LOYALTY: '/account/loyalty',
  ACCOUNT_MESSAGES: '/account/messages',
  ACCOUNT_CREATOR:         '/account/creator',
  ACCOUNT_CREATOR_EARNINGS: '/account/creator/earnings',
  ACCOUNT_CREATOR_PAYOUTS:  '/account/creator/payouts',

  CREATORS:     '/creators',
  CREATORS_JOIN: '/creators/join',

  AFFILIATE:           '/affiliate',
  AFFILIATE_REGISTER:  '/affiliate/register',
  AFFILIATE_DASHBOARD: '/affiliate/dashboard',
  AFFILIATE_PAYOUTS:   '/affiliate/payouts',

  PAGE_CONTACT:  '/pages/contact',
  PAGE_REVIEWS:  '/pages/reviews',
  PAGE_TERMS:    '/pages/terms',
  PAGE_PRIVACY:  '/pages/privacy',
} as const;
