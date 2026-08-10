export const QUEUES = {
  EMAIL:                'email',
  IMAGE_PROCESSING:     'image-processing',
  ORDER_PROCESSING:     'order-processing',
  SCHEDULED:            'scheduled',
  ABANDONED_CART:       'abandoned-cart',
  AFFILIATE_COMMISSION: 'affiliate-commission',
  LOW_STOCK:            'low-stock',
  TRANSLATIONS:         'translations',
  REFERRAL:             'referral',
  MODERATION:           'moderation',
  ORDER_TRACKING:       'order-tracking',
  FULFILLMENT:          'fulfillment',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOBS = {
  // Email
  SEND_EMAIL: 'send-email',

  // Image processing
  REMOVE_BACKGROUND:  'remove-background',
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

  // Order Tracking
  POLL_CARRIER_STATUS:    'poll-carrier-status',
  TRACKING_STAGE_UPDATE:  'tracking-stage-update',

  // Fulfillment (POD providers — Printify, etc.)
  PUSH_STORE_ORDER: 'push-store-order',
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

/** Default BullMQ job options applied to every queue */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 50 },
} as const;

/** Fulfillment provider APIs (Printify, etc.) are less reliable than our own
 *  infra — more attempts, longer backoff than DEFAULT_JOB_OPTIONS. */
export const FULFILLMENT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 100 },
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
  /** Unused by the processor itself (kept for caller bookkeeping/logging only) — optional so non-draft callers (e.g. product print-file generation) don't need one. */
  draftId?:   string;
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

export interface PushStoreOrderJobData {
  storeOrderId: string;
}
