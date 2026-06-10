export const API_ROUTES = {
  AUTH: {
    REGISTER:        '/auth/register',
    LOGIN:           '/auth/login',
    LOGOUT:          '/auth/logout',
    REFRESH:         '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD:  '/auth/reset-password',
    GOOGLE:          '/auth/google',
    GOOGLE_CALLBACK: '/auth/google/callback',
    VERIFY_EMAIL:    '/auth/verify-email',
  },

  USERS: {
    ME:              '/users/me',
    AVATAR:          '/users/me/avatar',
    PASSWORD:        '/users/me/password',
    ADDRESSES:       '/users/me/addresses',
    ADDRESS:         (id: string) => `/users/me/addresses/${id}`,
    WISHLIST:        '/users/me/wishlist',
    WISHLIST_ITEM:   (productId: string) => `/users/me/wishlist/${productId}`,
    WISHLIST_SHARE:  '/users/me/wishlist/share',
    ORDERS:          '/users/me/orders',
    FCM_TOKEN:       '/users/me/fcm-token',
    LOYALTY:         '/users/me/loyalty',
  },

  PRODUCTS: {
    LIST:            '/products',
    DETAIL:          (slug: string) => `/products/${slug}`,
    REVIEWS:         (slug: string) => `/products/${slug}/reviews`,
    REVIEW_SUMMARY:  (slug: string) => `/products/${slug}/reviews/summary`,
    RELATED:         (slug: string) => `/products/${slug}/related`,
    RECENTLY_VIEWED: '/products/recently-viewed',
    QA:              (slug: string) => `/products/${slug}/questions`,
  },

  CATALOG: {
    CATEGORIES:  '/catalog/categories',
    CATEGORY:    (slug: string) => `/catalog/categories/${slug}`,
    COLLECTIONS: '/catalog/collections',
    COLLECTION:  (slug: string) => `/catalog/collections/${slug}`,
    TAGS:        '/catalog/tags',
    MEGA_MENU:   '/catalog/mega-menu',
  },

  CART: {
    GET:         '/cart',
    ADD:         '/cart/items',
    UPDATE_ITEM: (itemId: string) => `/cart/items/${itemId}`,
    REMOVE_ITEM: (itemId: string) => `/cart/items/${itemId}`,
    CLEAR:       '/cart/clear',
    MERGE:       '/cart/merge',
    COUPON:      '/cart/coupon',
  },

  ORDERS: {
    LIST:        '/orders',
    DETAIL:      (orderNumber: string) => `/orders/${orderNumber}`,
    CREATE:      '/orders',
    CANCEL:      (orderNumber: string) => `/orders/${orderNumber}/cancel`,
    TRACK:       '/orders/track',
    TAX_PREVIEW: '/orders/tax-preview',
  },

  PAYMENTS: {
    INTENT:               '/payments/intent',
    CONFIRM:              '/payments/confirm',
    GIFT_CARD_APPLY:      '/payments/gift-card/apply',
    GIFT_CARD_BALANCE:    '/payments/gift-card/balance',
    GIFT_CARDS_PURCHASE:  '/payments/gift-cards/purchase',
    GIFT_CARDS_VALIDATE:  '/payments/gift-cards/validate',
    GIFT_CARD_VALIDATE_CODE: (code: string) => `/payments/gift-cards/${code}/validate`,
    WEBHOOK:              '/payments/webhook',
  },

  PROMOTIONS: {
    VALIDATE: '/promotions/validate',
  },

  SHIPPING: {
    CALCULATE: '/shipping/calculate',
    METHODS:   '/shipping/methods',
  },

  CUSTOMIZATION: {
    UPLOAD:          '/customization/upload-image',
    REMOVE_BG:       '/customization/remove-background',
    APPLY_ART_STYLE: '/customization/apply-art-style',
    JOB_STATUS:      (jobId: string) => `/customization/jobs/${jobId}`,
    PREVIEW:         '/customization/generate-preview',
    DRAFT:           '/customization/save-draft',
    LAST:            (productId: string) => `/customization/last/${productId}`,
    TEMPLATE:        (templateId: string) => `/customization/templates/${templateId}`,
    ART_STYLES:      '/customization/art-styles',
  },

  REVIEWS: {
    LIST:          '/reviews',
    UPLOAD_IMAGES: (reviewId: string) => `/reviews/${reviewId}/images`,
    UPLOAD_IMAGE:  '/reviews/upload-image',
    MY_REVIEWS:    '/reviews/me',
    CAN_REVIEW:    '/reviews/can-review',
  },

  SEARCH: {
    QUERY:        '/search',
    SUGGESTIONS:  '/search/suggestions',
    AUTOCOMPLETE: '/search/autocomplete',
    TRENDING:     '/search/trending',
    RELATED:      '/search/related',
    LOG:          '/search/log',
  },

  WISHLIST_PUBLIC: {
    SHARED: (token: string) => `/wishlist/${token}`,
  },

  AFFILIATES: {
    TRACK: '/affiliates/track',
  },

  CURRENCY: {
    RATES: '/currency/rates',
  },

  NOTIFICATIONS: {
    CONTACT: '/notifications/contact',
  },

  NEWSLETTER: {
    SUBSCRIBE: '/newsletter/subscribe',
  },

  ADMIN: {
    // ── Dashboard ────────────────────────────────────────────────────────────
    DASHBOARD_KPIS:      '/admin/dashboard/kpis',
    DASHBOARD_REVENUE:   '/admin/dashboard/revenue',
    DASHBOARD_BY_STATUS: '/admin/dashboard/orders-by-status',
    DASHBOARD_TOP:       '/admin/dashboard/top-products',
    PENDING_REVIEWS:     '/admin/dashboard/pending-reviews',

    // ── Orders ───────────────────────────────────────────────────────────────
    ORDERS:               '/admin/orders',
    ORDER:                (id: string) => `/admin/orders/${id}`,
    ORDER_STATUS:         (id: string) => `/admin/orders/${id}/status`,
    ORDER_TRACKING:       (id: string) => `/admin/orders/${id}/tracking`,
    ORDER_SHIP:           (id: string) => `/admin/orders/${id}/ship`,
    ORDER_INVOICE:        (id: string) => `/admin/orders/${id}/invoice`,
    ORDER_PACKING_SLIP:   (id: string) => `/admin/orders/${id}/packing-slip`,
    ORDER_RATES:          (id: string) => `/admin/orders/${id}/rates`,
    ORDER_BUY_LABEL:      (id: string) => `/admin/orders/${id}/buy-label`,
    ORDERS_BULK_SLIPS:    '/admin/orders/bulk-packing-slips',
    ORDERS_EXPORT:        '/admin/orders/export',

    // ── Products ─────────────────────────────────────────────────────────────
    PRODUCTS:             '/admin/products',
    PRODUCT:              (id: string) => `/admin/products/${id}`,
    PRODUCT_STATUS:       (id: string) => `/admin/products/${id}/status`,
    PRODUCT_IMAGES:       (id: string) => `/admin/products/${id}/images`,
    PRODUCT_IMAGE:        (id: string, imgId: string) => `/admin/products/${id}/images/${imgId}`,
    PRODUCT_IMAGES_REORDER: (id: string) => `/admin/products/${id}/images/reorder`,
    PRODUCT_IMAGES_FROM_URLS: (id: string) => `/admin/products/${id}/images/from-urls`,
    PRODUCT_DETAIL:       (id: string) => `/admin/products/${id}/detail`,
    PRODUCT_VARIANTS:     (id: string) => `/admin/products/${id}/variants`,
    PRODUCT_VARIANTS_REORDER: (id: string) => `/admin/products/${id}/variants/reorder`,
    PRODUCT_ATTRIBUTES:   (id: string) => `/admin/products/${id}/attributes`,
    PRODUCT_QUESTIONS:    (id: string) => `/admin/products/${id}/questions`,
    PRODUCT_QUESTION_ANSWER: (id: string, qId: string) => `/admin/products/${id}/questions/${qId}/answer`,
    PRODUCT_QUESTION:     (id: string, qId: string) => `/admin/products/${id}/questions/${qId}`,
    PRODUCT_QUESTION_SPAM: (id: string, qId: string) => `/admin/products/${id}/questions/${qId}/spam`,
    // Variations
    PRODUCT_VARIATIONS:         (id: string) => `/admin/products/${id}/variations`,
    PRODUCT_VARIATION_SETTINGS: (id: string) => `/admin/products/${id}/variation-settings`,
    PRODUCT_VARIATION_GROUPS:   (id: string) => `/admin/products/${id}/variations/groups`,
    PRODUCT_VARIATION_GROUP:    (id: string, gId: string) => `/admin/products/${id}/variations/groups/${gId}`,
    PRODUCT_VARIATION_OPTIONS:  (id: string, gId: string) => `/admin/products/${id}/variations/${gId}/options`,
    PRODUCT_VARIATION_OPTION:   (id: string, gId: string, oId: string) => `/admin/products/${id}/variations/${gId}/options/${oId}`,
    PRODUCT_VARIATION_VARIANT:  (id: string, vId: string) => `/admin/products/${id}/variations/variants/${vId}`,
    // Custom options
    PRODUCT_CUSTOM_OPTIONS:      (id: string) => `/admin/products/${id}/custom-options`,
    PRODUCT_CUSTOM_OPTION:       (id: string, oId: string) => `/admin/products/${id}/custom-options/${oId}`,
    PRODUCT_CUSTOM_OPTIONS_REORDER: (id: string) => `/admin/products/${id}/custom-options/reorder`,
    PRODUCTS_BULK:        '/admin/products/bulk',
    PRODUCTS_EXPORT:      '/admin/products/export',
    PRODUCTS_DRAFT:       '/admin/products/draft',
    PRODUCTS_SEO_STATS:   '/admin/products/seo-stats',
    PRODUCTS_IMPORT_TEMPLATE: '/admin/products/import/template',
    PRODUCTS_IMPORT_VALIDATE: '/admin/products/import/validate',
    PRODUCTS_IMPORT_EXECUTE:  '/admin/products/import/execute',
    QUESTIONS_UNANSWERED: '/admin/questions/unanswered-count',

    // ── Catalog ──────────────────────────────────────────────────────────────
    CATEGORIES:           '/admin/categories',
    CATEGORY:             (id: string) => `/admin/categories/${id}`,
    COLLECTIONS:          '/admin/collections',
    COLLECTION:           (id: string) => `/admin/collections/${id}`,
    CATALOG_SYNC:         '/admin/catalog/sync-mega-menu',
    ATTRIBUTES:           (type: string) => `/admin/attributes/${type}`,
    SHOP_SECTIONS:        '/admin/shop-sections',
    SHOP_SECTION:         (id: string) => `/admin/shop-sections/${id}`,
    PRODUCTION_PARTNERS:  '/admin/production-partners',
    PRODUCTION_PARTNER:   (id: string) => `/admin/production-partners/${id}`,

    // ── Users / Customers ─────────────────────────────────────────────────────
    USERS:                '/admin/users',
    USER:                 (id: string) => `/admin/users/${id}`,
    CUSTOMERS:            '/admin/customers',
    CUSTOMER:             (id: string) => `/admin/customers/${id}`,
    CUSTOMER_NOTES:       (id: string) => `/admin/customers/${id}/notes`,
    CUSTOMER_TAGS:        (id: string) => `/admin/customers/${id}/tags`,
    CUSTOMERS_STATS:      '/admin/customers/stats',

    // ── Reviews ──────────────────────────────────────────────────────────────
    REVIEWS:              '/admin/reviews',
    REVIEWS_COUNTS:       '/admin/reviews/counts',
    REVIEW:               (id: string) => `/admin/reviews/${id}`,
    REVIEW_APPROVE:       (id: string) => `/admin/reviews/${id}/approve`,
    REVIEW_HIDE:          (id: string) => `/admin/reviews/${id}/hide`,
    REVIEW_REPLY:         (id: string) => `/admin/reviews/${id}/reply`,

    // ── Promotions ───────────────────────────────────────────────────────────
    PROMOTIONS:             '/admin/promotions',
    PROMOTION:              (id: string) => `/admin/promotions/${id}`,
    PROMOTIONS_PAGE_STATS:  '/promotions/page-stats',
    PROMOTION_STATS:        (id: string) => `/promotions/${id}/stats`,

    // ── Shipping ─────────────────────────────────────────────────────────────
    SHIPPING_SETTINGS:          '/admin/shipping/settings',
    SHIPPING_ZONES:             '/admin/shipping/zones',
    SHIPPING_ZONE:              (id: string) => `/admin/shipping/zones/${id}`,
    SHIPPING_ZONE_METHODS:      (zoneId: string) => `/admin/shipping/zones/${zoneId}/methods`,
    SHIPPING_METHOD:            (id: string) => `/admin/shipping/methods/${id}`,
    SHIPPING_PROFILES:          '/admin/shipping/profiles',
    SHIPPING_PROCESSING_PROFILES: '/admin/shipping/processing-profiles',

    // ── Messages ─────────────────────────────────────────────────────────────
    CONVERSATIONS:        '/admin/messages/conversations',
    CONVERSATION:         (id: string) => `/admin/messages/conversations/${id}`,
    CONVERSATION_MESSAGES: (id: string) => `/admin/messages/conversations/${id}/messages`,
    CONVERSATION_STATUS:  (id: string) => `/admin/messages/conversations/${id}/status`,
    CONVERSATION_READ:    (id: string) => `/admin/messages/conversations/${id}/read`,

    // ── Affiliates ───────────────────────────────────────────────────────────
    AFFILIATES:           '/admin/affiliates',
    AFFILIATE:            (id: string) => `/admin/affiliates/${id}`,
    AFFILIATES_PENDING_COUNT: '/admin/affiliates/pending-count',
    AFFILIATES_SETTINGS:  '/admin/affiliates/settings',
    AFFILIATES_PAYOUTS:   '/admin/affiliates/payouts',
    AFFILIATE_APPROVE:    (id: string) => `/admin/affiliates/${id}/approve`,
    AFFILIATE_REJECT:     (id: string) => `/admin/affiliates/${id}/reject`,
    AFFILIATE_PAYOUT:     (id: string) => `/admin/affiliates/${id}/payout`,
    PAYOUT_PAY:           (id: string) => `/admin/affiliates/payouts/${id}/pay`,
    PAYOUT_REJECT:        (id: string) => `/admin/affiliates/payouts/${id}/reject`,

    // ── Assets ───────────────────────────────────────────────────────────────
    ASSETS_PRESIGN:       '/admin/assets/presign',

    // ── Payments ─────────────────────────────────────────────────────────────
    PAYMENTS_LIST:        '/payments',
    PAYMENTS_STATS:       '/payments/stats',
    PAYMENT_REFUNDS:      (id: string) => `/payments/${id}/refunds`,
    PAYMENT_REFUND:       (id: string) => `/payments/${id}/refund`,
    ORDER_REFUND:         (id: string) => `/payments/${id}/refund`,

    // ── Cache / Admin ops ────────────────────────────────────────────────────
    CACHE_FLUSH:          '/admin/cache/flush',
    EMAIL_TEMPLATES:      '/admin/email-templates',
    EMAIL_TEMPLATE:       (slug: string) => `/admin/email-templates/${slug}`,
    EXPORT_DATA:          '/admin/export/data',
    TEAM:                 '/admin/team',
    TEAM_INVITE:          '/admin/team/invite',
    TEAM_MEMBER:          (id: string) => `/admin/team/${id}`,

    // ── Settings ─────────────────────────────────────────────────────────────
    SETTINGS_STORE:         '/admin/settings/store',
    SETTINGS_EMAIL:         '/admin/settings/email',
    SETTINGS_EMAIL_TEST:    '/admin/settings/email/test',
    SETTINGS_NOTIFICATIONS: '/admin/settings/notifications',
    SETTINGS_SEO:           '/admin/settings/seo',
  },
} as const;
