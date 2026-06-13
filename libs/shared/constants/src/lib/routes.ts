export const API_ROUTES = {
  AUTH: {
    REGISTER:        '/auth/register',
    LOGIN:           '/auth/login',
    LOGOUT:          '/auth/logout',
    REFRESH:         '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD:  '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
    GOOGLE:          '/auth/google',
    GOOGLE_CALLBACK: '/auth/google/callback',
    VERIFY_EMAIL:    '/auth/verify-email',
    RESEND_VERIFY:   '/auth/resend-verification',
    TOTP_VERIFY:     '/auth/totp/verify',
    TOTP_SETUP:      '/auth/totp/setup',
    TOTP_CONFIRM:    '/auth/totp/confirm',
    TOTP_DISABLE:    '/auth/totp/disable',
  },

  USERS: {
    ME:              '/users/me',
    AVATAR:          '/users/me/avatar',
    PASSWORD:        '/users/me/password',
    ADDRESSES:       '/users/me/addresses',
    ADDRESS:         (id: string) => `/users/me/addresses/${id}`,
    ADDRESS_DEFAULT: (id: string) => `/users/me/addresses/${id}/default`,
    WISHLIST:        '/users/me/wishlist',
    WISHLIST_ITEM:   (productId: string) => `/users/me/wishlist/${productId}`,
    WISHLIST_SHARE:  '/users/me/wishlist/share',
    ORDERS:          '/users/me/orders',
    FCM_TOKEN:       '/users/me/fcm-token',
    LOYALTY:         '/users/me/loyalty',
  },

  PRODUCTS: {
    LIST:              '/products',
    DETAIL:            (slug: string) => `/products/${slug}`,
    REVIEWS:           (slug: string) => `/products/${slug}/reviews`,
    REVIEW_SUMMARY:    (slug: string) => `/products/${slug}/reviews/summary`,
    MY_REVIEW:         (slug: string) => `/products/${slug}/reviews/my-review`,
    REVIEW_HELPFUL:    (slug: string, reviewId: string) => `/products/${slug}/reviews/${reviewId}/helpful`,
    RELATED:           (slug: string) => `/products/${slug}/related`,
    RECENTLY_VIEWED:   '/products/recently-viewed',
    VIEWED:            (id: string) => `/products/${id}/viewed`,
    TRENDING:          '/products/trending',
    QA:                (slug: string) => `/products/${slug}/questions`,
    QUESTION_UPVOTE:   (id: string) => `/questions/${id}/upvote`,
    REVIEWABLE_PRODUCTS: '/reviews/me/reviewable-products',
  },

  CATALOG: {
    CATEGORIES:  '/catalog/categories',
    CATEGORY:    (slug: string) => `/catalog/categories/${slug}`,
    CATEGORY_ATTRS: (slug: string) => `/catalog/categories/${slug}/filterable-attributes`,
    COLLECTIONS: '/collections',
    COLLECTION:  (slug: string) => `/collections/${slug}`,
    TAGS:        '/tags',
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

  STORE_CREDITS: {
    STORE_CREDITS_ME:    '/store-credits/me',
    BUYER_REFERRAL_LINK: (orderNumber: string) => `/orders/${orderNumber}/buyer-referral`,
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
    PAYPAL_CREATE_ORDER:  '/payments/paypal/create-order',
    PAYPAL_CAPTURE:       '/payments/paypal/capture',
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
    SUMMARY:       '/reviews/summary',
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

  MESSAGES: {
    CONVERSATIONS:         '/messages/conversations',
    CONVERSATION:          (id: string) => `/messages/conversations/${id}`,
    CONVERSATION_MESSAGES: (id: string) => `/messages/conversations/${id}/messages`,
    CONVERSATION_READ:     (id: string) => `/messages/conversations/${id}/read`,
  },

  LOYALTY: {
    ME:      '/loyalty/me',
    PREVIEW: '/loyalty/preview',
    CONFIG:  '/loyalty/config',
  },

  AFFILIATES: {
    TRACK:           '/affiliates/track',
    APPLY:           '/affiliates/apply',
    RESOLVE:         '/affiliates/resolve',
    SETTINGS_PUBLIC: '/affiliates/settings/public',
    ME:              '/affiliates/me',
    ME_DASHBOARD:    '/affiliates/me/dashboard',
    ME_CLICKS:       '/affiliates/me/clicks',
    ME_PAYOUTS:      '/affiliates/me/payouts',
  },

  REFERRALS: {
    ME:              '/referrals/me',
    ME_COMMISSIONS:  '/referrals/me/commissions',
    ME_PAYOUTS:      '/referrals/me/payouts',
    ME_PAYOUT_REQUEST: '/referrals/me/payouts/request',
  },

  CREATORS: {
    ME:                '/creators/me',
    ME_EARNINGS:       '/creators/me/earnings',
    ME_WITHDRAWALS:    '/creators/me/withdrawals',
    ME_WITHDRAWAL_REQ: '/creators/me/withdrawals/request',
    ME_TREE:           '/creators/me/tree',
    RESOLVE:           '/creators/resolve',
    PUBLIC_STATS:      '/creators/public-stats',
  },

  WISHLIST_PUBLIC: {
    SHARED: (token: string) => `/wishlist/${token}`,
  },

  CURRENCY: {
    RATES: '/currency/rates',
  },

  NOTIFICATIONS: {
    CONTACT:       '/notifications/contact',
    PRODUCT_READY: '/notifications/product-ready',
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
    DASHBOARD_PLATFORM:  '/admin/dashboard/platform',
    DASHBOARD_ACTIVITY:  '/admin/dashboard/activity',
    DASHBOARD_TOP_STORES: '/admin/dashboard/top-stores',

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
    ORDER_NOTE:           (id: string) => `/admin/orders/${id}/note`,
    ORDER_CANCEL:         (id: string) => `/admin/orders/${id}/cancel`,
    ORDER_EARNINGS:       (id: string) => `/admin/orders/${id}/earnings`,

    // ── Shop Stats ───────────────────────────────────────────────────────────
    STATS_OVERVIEW:       '/admin/stats/overview',
    STATS_SHOPPER:        '/admin/stats/shopper-stats',
    STATS_TRAFFIC_SOURCES:'/admin/stats/traffic-sources',
    STATS_LISTINGS:       '/admin/stats/listings',
    STATS_LISTING:        (id: string) => `/admin/stats/listings/${id}`,
    STATS_SEARCH_TERMS:   '/admin/stats/search-terms',

    // ── Products ─────────────────────────────────────────────────────────────
    PRODUCTS:             '/admin/products',
    PRODUCTS_STATS:       '/admin/products/stats',
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
    PRODUCT_RELATED:      (id: string) => `/admin/products/${id}/related`,
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
    ADMIN_TAGS:           '/admin/tags',
    ADMIN_TAG:            (id: string) => `/admin/tags/${id}`,
    AUDIT_LOGS:           '/admin/audit-logs',

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
    SETTINGS_THEME:         '/admin/settings/theme',

    // ── Translations ─────────────────────────────────────────────────────────
    TRANSLATIONS:           (entityType: string, entityId: string) => `/admin/translations/${entityType}/${entityId}`,
    TRANSLATIONS_RETRANSLATE: (entityType: string, entityId: string) => `/admin/translations/${entityType}/${entityId}/retranslate`,

    // ── Creator Network (renamed from Referrals) ──────────────────────────────
    ADMIN_CREATORS_OVERVIEW:  '/admin/referrals/overview',
    ADMIN_CREATORS_MEMBERS:   '/admin/referrals/users',
    ADMIN_CREATORS_MEMBER_TREE: (id: string) => `/admin/referrals/users/${id}/tree`,
    ADMIN_CREATORS_PAYOUTS:   '/admin/referrals/payouts',
    ADMIN_CREATORS_PAYOUT_PAY:    (id: string) => `/admin/referrals/payouts/${id}/pay`,
    ADMIN_CREATORS_PAYOUT_REJECT: (id: string) => `/admin/referrals/payouts/${id}/reject`,
    ADMIN_CREATORS_SETTINGS:  '/admin/referrals/settings',
    ADMIN_CREATORS_TIERS:     '/admin/referrals/tiers',
    ADMIN_CREATORS_TIER:      (id: string) => `/admin/referrals/tiers/${id}`,

    // ── Stores (multi-vendor marketplace) ────────────────────────────────────
    STORES:                   '/admin/stores',
    STORE:                    (id: string) => `/admin/stores/${id}`,
    STORE_APPROVE:            (id: string) => `/admin/stores/${id}/approve`,
    STORE_REJECT:             (id: string) => `/admin/stores/${id}/reject`,
    STORE_SUSPEND:            (id: string) => `/admin/stores/${id}/suspend`,
    STORE_PLAN:               (id: string) => `/admin/stores/${id}/plan`,
    STORE_BANNER:             (id: string) => `/admin/stores/${id}/banner`,
    STORE_LOGO:               (id: string) => `/admin/stores/${id}/logo`,
    STORE_PRODUCTS:           (id: string) => `/admin/stores/${id}/products`,
    STORE_ORDERS:             (id: string) => `/admin/stores/${id}/orders`,
    STORES_PENDING_COUNT:     '/admin/stores?status=PENDING',
    SELLER_PLANS:             '/admin/plans',
    SELLER_PLAN:              (id: string) => `/admin/plans/${id}`,
    PLATFORM_SETTINGS:        '/admin/platform-settings',
    SELLER_PAYOUTS:           '/admin/seller-payouts',
    SELLER_PAYOUT:            (id: string) => `/admin/seller-payouts/${id}`,
    SELLER_PAYOUT_PAY:        (id: string) => `/admin/seller-payouts/${id}/pay`,
    SELLER_PAYOUTS_STATS:     '/admin/seller-payouts/stats',

    // ── Finance ──────────────────────────────────────────────────────────────
    FINANCE_STATS:            '/admin/finance/stats',
    FINANCE_STORES:           '/admin/finance/stores',
    FINANCE_CHART:            '/admin/finance/chart',

    // ── Moderation / Trust & Safety ──────────────────────────────────────────
    MODERATION_FLAGS:         '/admin/moderation/flags',
    MODERATION_STATS:         '/admin/moderation/stats',
    MODERATION_FLAG:          (id: string) => `/admin/moderation/flags/${id}`,
    MODERATION_FLAG_APPROVE:  (id: string) => `/admin/moderation/flags/${id}/approve`,
    MODERATION_FLAG_REJECT:   (id: string) => `/admin/moderation/flags/${id}/reject`,
    MODERATION_FLAG_ESCALATE: (id: string) => `/admin/moderation/flags/${id}/escalate`,
    MODERATION_RULES:         '/admin/moderation/rules',
    MODERATION_RULE:          (id: string) => `/admin/moderation/rules/${id}`,
    MODERATION_RULE_TOGGLE:   (id: string) => `/admin/moderation/rules/${id}/toggle`,

    MODERATION_QUEUE:        '/admin/moderation/queue',
    MODERATION_LOGS:         '/admin/moderation/logs',
    MODERATION_LOG:          (id: string) => `/admin/moderation/logs/${id}`,
    MODERATION_LOG_APPROVE:  (id: string) => `/admin/moderation/logs/${id}/approve`,
    MODERATION_LOG_REJECT:   (id: string) => `/admin/moderation/logs/${id}/reject`,
    MODERATION_RECHECK:      '/admin/moderation/recheck',
    MODERATION_SETTINGS:     '/admin/moderation/settings',
    MODERATION_STORE_VIOLATIONS: (storeId: string) => `/admin/stores/${storeId}/violations`,
    MODERATION_STORE_CLEAR_STRIKES: (storeId: string) => `/admin/stores/${storeId}/clear-strikes`,

    // ── Store Credits ────────────────────────────────────────────────────────
    STORE_CREDITS:         '/admin/store-credits',
    STORE_CREDITS_STATS:   '/admin/store-credits/stats',

    // ── AI Features ──────────────────────────────────────────────────────────
    AI_STATS:                    '/admin/ai/stats',
    AI_TREND_DRAFTS:             '/admin/ai/trend-drafts',
    AI_TREND_DRAFT:              (id: string) => `/admin/ai/trend-drafts/${id}`,
    AI_TREND_DRAFT_APPROVE:      (id: string) => `/admin/ai/trend-drafts/${id}/approve`,
    AI_TREND_DRAFT_REJECT:       (id: string) => `/admin/ai/trend-drafts/${id}/reject`,
    AI_TREND_SCAN:               '/admin/ai/trends/trigger-scan',
    AI_TREND_PENDING_COUNT:      '/admin/ai/trend-drafts/pending-count',
    AI_PRICING_STATS:            '/admin/ai/pricing/stats',
    AI_PRICING_TESTS:            '/admin/ai/pricing/tests',
    AI_PRICING_TEST_END:         (id: string) => `/admin/ai/pricing/tests/${id}/end`,
    AI_PRICING_TEST_REVERT:      (id: string) => `/admin/ai/pricing/tests/${id}/revert`,
    AI_CREATOR_DNA_LIST:         '/admin/ai/creator-dna',
    AI_CREATOR_DNA_REANALYZE:    (id: string) => `/admin/ai/creator-dna/${id}/reanalyze`,
    AI_USAGE:                    '/admin/ai/usage',
    AI_SETTINGS:                 '/admin/ai/settings',
  },

  STORES: {
    LIST:             '/stores',
    DETAIL:           (slug: string) => `/stores/${slug}`,
    REVIEWS:          (slug: string) => `/stores/${slug}/reviews`,
    REVIEWS_SUMMARY:  (slug: string) => `/stores/${slug}/reviews/summary`,
  },

  // ── Seller (store-owner portal) ─────────────────────────────────────────────
  SELLER: {
    DASHBOARD_STATS:   '/seller/orders/stats',
    DASHBOARD_RECENT:  '/seller/orders/recent',
    PRODUCTS:          '/seller/products',
    PRODUCT:           (id: string) => `/seller/products/${id}`,
    PRODUCT_STATUS:    (id: string) => `/seller/products/${id}/status`,
    ORDERS:            '/seller/orders',
    ORDER:             (id: string) => `/seller/orders/${id}`,
    ORDERS_COUNTS:     '/seller/orders/counts',
    PAYOUTS:           '/seller/payouts',
    PAYOUT_REQUEST:    '/seller/payouts/request',
    PAYOUT_STATS:      '/seller/payouts/stats',
    STORE_ME:          '/stores/me',
    STORE_ME_UPDATE:   '/stores/me',
    STORE_APPLY:       '/stores/apply',
    STORE_APPLICATION: '/stores/me/application',
  },
} as const;

