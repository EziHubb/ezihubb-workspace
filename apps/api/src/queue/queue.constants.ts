export const QUEUES = {
  EMAIL:                'email',
  IMAGE_PROCESSING:     'image-processing',
  ORDER_PROCESSING:     'order-processing',
  SCHEDULED:            'scheduled',
  ABANDONED_CART:       'abandoned-cart',
  AFFILIATE_COMMISSION: 'affiliate-commission',
  LOYALTY:              'loyalty',
  LOW_STOCK:            'low-stock',
  TRANSLATIONS:         'translations',
  REFERRAL:             'referral',
  MODERATION:           'moderation',
  AI_FEATURES:          'ai-features',
  COINS:                'coins',
  ORDER_TRACKING:       'order-tracking',
  FLASH_DEALS:          'flash-deals',
  GIFT_POOLS:           'gift-pools',
  GIFT_CHAINS:          'gift-chains',
  BLIND_MATCH:          'blind-match',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOBS = {
  // Email
  SEND_EMAIL: 'send-email',

  // Image processing
  REMOVE_BACKGROUND:  'remove-background',
  GENERATE_PREVIEW:   'generate-preview',
  APPLY_ART_STYLE:    'apply-art-style',
  CLEANUP_TEMP_IMAGES:'cleanup-temp-images',

  // Order
  ORDER_CONFIRMED:      'order-confirmed',
  ORDER_AUTO_COMPLETE:  'order-auto-complete',

  // Scheduled (paired with cron triggers)
  DAILY_REVIEW_REMINDERS:    'daily-review-reminders',
  DAILY_ORDER_AUTO_COMPLETE: 'daily-order-auto-complete',
  WEEKLY_CLEANUP_CARTS:      'weekly-cleanup-carts',

  // Abandoned cart
  SCAN_ABANDONED_CARTS: 'scan-abandoned-carts',

  // Low stock
  DAILY_LOW_STOCK_SCAN: 'daily-low-stock-scan',

  // Translations
  TRANSLATE_ENTITY: 'translate-entity',

  // Referral
  REFERRAL_AUTO_CONFIRM: 'referral-auto-confirm',
  REFERRAL_CHECK_TIER:   'referral-check-tier',

  // Moderation
  CHECK_TEXT:  'check-text',
  CHECK_IMAGE: 'check-image',

  // Buyer Referral Store Credit
  BUYER_REFERRAL_CREATE:  'buyer-referral-create',
  BUYER_REFERRAL_PROCESS: 'buyer-referral-process',
  BUYER_REFERRAL_EXPIRE:  'buyer-referral-expire',

  // BF-01: Coins
  COIN_EXPIRE_DAILY:      'coin-expire-daily',

  // BF-02: Order Tracking
  POLL_CARRIER_STATUS:    'poll-carrier-status',
  TRACKING_STAGE_UPDATE:  'tracking-stage-update',

  // BF-03: Flash Deals
  FLASH_DEAL_ACTIVATE:    'flash-deal-activate',
  FLASH_DEAL_END:         'flash-deal-end',
  FLASH_DEAL_REMINDER:    'flash-deal-reminder',

  // BF-05: VIP
  VIP_TIER_RECOMPUTE:     'vip-tier-recompute',

  // BF-06: Gift Pools
  GIFT_POOL_COMPLETE:     'gift-pool-complete',
  GIFT_POOL_EXPIRE:       'gift-pool-expire',
  GIFT_POOL_REMINDER:     'gift-pool-reminder',

  // BF-08: Gift Chain
  GIFT_CHAIN_NUDGE:       'gift-chain-nudge',
  GIFT_CHAIN_CLOSE:       'gift-chain-close',

  // BF-09: Blind Match
  BLIND_MATCH_PROCESS:    'blind-match-process',
  BLIND_MATCH_CREDIT:     'blind-match-credit',
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

/** Default BullMQ job options applied to every queue */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 50 },
} as const;

// ── Job data interfaces ───────────────────────────────────────────────────────

export interface SendEmailJobData {
  to:       string;
  template: string;
  subject:  string;
  data:     Record<string, unknown>;
}

export interface RemoveBackgroundJobData {
  uploadKey:  string;
  outputKey:  string;
  draftId:    string;
}

export interface GeneratePreviewJobData {
  draftId:    string;
  canvasData: Record<string, unknown>;
  outputKey:  string;
}

export interface ApplyArtStyleJobData {
  jobId:    string;  // custom `artstyle_*` ID used for Redis key
  imageKey: string;  // R2 key of the source image
  styleId:  string;  // one of ART_STYLE_IDS
}

export interface OrderConfirmedJobData {
  orderId:     string;
  orderNumber: string;
  customerEmail: string;
}

export interface OrderAutoCompleteJobData {
  orderId: string;
}

export interface CheckTextJobData {
  entityType: string;
  entityId:   string;
  fieldName:  string;
  content:    string;
  storeId?:   string;
}

export interface CheckImageJobData {
  entityType: string;
  entityId:   string;
  imageUrl:   string;
  storeId?:   string;
}

export interface BuyerReferralCreateJobData { orderId: string; }
export interface BuyerReferralProcessJobData { orderId: string; cookieToken: string; }

export const AI_JOBS = {
  // Pricing
  ANALYZE_PRICING:       'analyze-pricing',
  RECORD_IMPRESSION:     'record-impression',
  RECORD_CONVERSION:     'record-conversion',
  EVALUATE_AB_TEST:      'evaluate-ab-test',

  // Trend → Product
  FETCH_TRENDS:          'fetch-trends',
  GENERATE_DESIGN_BRIEF: 'generate-design-brief',
  GENERATE_DESIGN_IMAGE: 'generate-design-image',
  EXPIRE_OLD_DRAFTS:     'expire-old-drafts',

  // Creator DNA
  FETCH_SOCIAL_DATA:     'fetch-social-data',
  ANALYZE_AUDIENCE:      'analyze-audience',
} as const;

export type AiJobName = (typeof AI_JOBS)[keyof typeof AI_JOBS];
