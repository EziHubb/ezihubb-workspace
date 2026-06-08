export const QUEUES = {
  EMAIL:            'email',
  IMAGE_PROCESSING: 'image-processing',
  ORDER_PROCESSING: 'order-processing',
  SCHEDULED:        'scheduled',
  ABANDONED_CART:   'abandoned-cart',
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

export interface OrderConfirmedJobData {
  orderId:     string;
  orderNumber: string;
  customerEmail: string;
}

export interface OrderAutoCompleteJobData {
  orderId: string;
}
