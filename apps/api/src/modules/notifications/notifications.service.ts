import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';

export const EmailTemplate = {
  WELCOME:             'welcome',
  EMAIL_VERIFY:        'email-verify',
  RESET_PASSWORD:      'reset-password',
  ORDER_CONFIRMATION:  'order-confirmation',
  ORDER_SHIPPED:       'order-shipped',
  ORDER_DELIVERED:     'order-delivered',
  REVIEW_REMINDER:     'review-reminder',
  REFUND_NOTIFICATION: 'refund-notification',
  CONTACT_MESSAGE:     'contact-message',
  NEW_MESSAGE:         'new-message',
  ABANDONED_CART:      'abandoned-cart',
  LOW_STOCK_ALERT:            'low-stock-alert',
  CONTENT_FLAGGED:            'content-flagged',
  CONTENT_REJECTED_CRITICAL:  'content-rejected-critical',
  CONTENT_WARNING:            'content-warning',
  MODERATION_CRITICAL_ALERT:  'moderation-critical-alert',
  STORE_STRIKE_WARNING:       'store-strike-warning',
  NEWSLETTER_WELCOME:         'newsletter-welcome',
} as const;

export type EmailTemplateName = (typeof EmailTemplate)[keyof typeof EmailTemplate];

export interface QueueEmailOptions {
  to: string;
  subject: string;
  template: EmailTemplateName;
  data: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async queueEmail(options: QueueEmailOptions): Promise<void> {
    await this.emailQueue.add(JOBS.SEND_EMAIL, options, DEFAULT_JOB_OPTIONS);
    this.logger.debug(`Queued email: template="${options.template}" to="${options.to}"`);
  }

  // ── Specific email helpers ────────────────────────────────────────────────────

  async sendWelcomeEmail(to: string, firstName?: string): Promise<void> {
    const shopUrl = process.env['NEXT_PUBLIC_URL'] ?? 'http://localhost:3000';
    return this.queueEmail({
      to,
      subject: 'Welcome to EziHubb!',
      template: EmailTemplate.WELCOME,
      data: { firstName: firstName ?? 'Valued Customer', shopUrl, year: new Date().getFullYear() },
    });
  }

  async sendEmailVerification(to: string, token: string, firstName?: string): Promise<void> {
    return this.queueEmail({
      to,
      subject: 'Verify your email address',
      template: EmailTemplate.EMAIL_VERIFY,
      data: { firstName: firstName ?? 'Valued Customer', token },
    });
  }

  async sendPasswordResetEmail(to: string, token: string, firstName?: string): Promise<void> {
    return this.queueEmail({
      to,
      subject: 'Reset your password',
      template: EmailTemplate.RESET_PASSWORD,
      data: { firstName: firstName ?? 'Valued Customer', token },
    });
  }

  async sendOrderConfirmation(order: {
    email: string;
    orderNumber: string;
    orderId: string;
    firstName?: string;
    items: { productName: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    discountAmount: number;
    shippingCost: number;
    total: number;
    shippingName: string;
    shippingAddress: string;
    shippingCity: string;
    shippingCountry: string;
    shippingMethod: string;
  }): Promise<void> {
    return this.queueEmail({
      to: order.email,
      subject: `Order confirmed: ${order.orderNumber}`,
      template: EmailTemplate.ORDER_CONFIRMATION,
      data: { ...order },
    });
  }

  async sendOrderShipped(order: {
    email: string;
    orderNumber: string;
    firstName?: string;
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
  }): Promise<void> {
    return this.queueEmail({
      to: order.email,
      subject: `Your order ${order.orderNumber} has shipped!`,
      template: EmailTemplate.ORDER_SHIPPED,
      data: { ...order, year: new Date().getFullYear() },
    });
  }

  async sendOrderDelivered(order: {
    email: string;
    orderNumber: string;
    orderId: string;
    firstName?: string;
    items: { productName: string; productSlug: string }[];
  }): Promise<void> {
    return this.queueEmail({
      to: order.email,
      subject: `Your order ${order.orderNumber} has been delivered!`,
      template: EmailTemplate.ORDER_DELIVERED,
      data: { ...order },
    });
  }

  async sendReviewReminder(order: {
    email: string;
    firstName?: string;
    orderNumber: string;
    orderId: string;
    productName: string;
    productSlug: string;
  }): Promise<void> {
    return this.queueEmail({
      to: order.email,
      subject: 'How was your order? Leave a review!',
      template: EmailTemplate.REVIEW_REMINDER,
      data: { ...order },
    });
  }

  async sendContactMessage(params: {
    name:        string;
    email:       string;
    subject:     string;
    message:     string;
    orderNumber?: string;
  }): Promise<void> {
    const supportEmail = process.env['SUPPORT_EMAIL'] ?? 'support@ezihubb.com';
    // Notify support inbox
    await this.queueEmail({
      to:       supportEmail,
      subject:  `[Contact Form] ${params.subject} — ${params.name}`,
      template: EmailTemplate.CONTACT_MESSAGE,
      data:     { ...params },
    });
    // Confirm receipt to sender
    return this.queueEmail({
      to:       params.email,
      subject:  'We received your message — EziHubb',
      template: EmailTemplate.CONTACT_MESSAGE,
      data:     { ...params, isConfirmation: true },
    });
  }

  async sendNewMessageNotification(params: {
    senderType:   'CUSTOMER' | 'SHOP';
    senderName:   string;
    recipientEmail: string;
    messagePreview: string;
    orderNumber?:   string;
    orderId?:       string;
  }): Promise<void> {
    const adminEmail  = process.env['ADMIN_EMAIL'] ?? 'admin@ezihubb.com';
    const adminUrl    = process.env['ADMIN_URL']   ?? 'http://localhost:3001';
    const frontendUrl = process.env['NEXT_PUBLIC_URL'] ?? 'http://localhost:3000';
    const year = new Date().getFullYear();

    if (params.senderType === 'CUSTOMER') {
      return this.queueEmail({
        to:       adminEmail,
        subject:  `New message from ${params.senderName}`,
        template: EmailTemplate.NEW_MESSAGE,
        data: {
          isForAdmin:     true,
          senderName:     params.senderName,
          orderNumber:    params.orderNumber,
          messagePreview: params.messagePreview,
          replyUrl:       `${adminUrl}/messages${params.orderId ? `?orderId=${params.orderId}` : ''}`,
          year,
        },
      });
    }

    return this.queueEmail({
      to:       params.recipientEmail,
      subject:  'EziHubb replied to your message',
      template: EmailTemplate.NEW_MESSAGE,
      data: {
        isForAdmin:     false,
        orderNumber:    params.orderNumber,
        messagePreview: params.messagePreview,
        replyUrl:       `${frontendUrl}/account/messages`,
        year,
      },
    });
  }

  async sendRefundNotification(order: {
    email: string;
    firstName?: string;
    orderNumber: string;
    refundAmount: number;
    currency: string;
  }): Promise<void> {
    return this.queueEmail({
      to: order.email,
      subject: `Refund processed for order ${order.orderNumber}`,
      template: EmailTemplate.REFUND_NOTIFICATION,
      data: { ...order },
    });
  }

  async sendContentFlagged(to: string, data: { sellerName: string; entityType: string; sellerMessage: string; contentPreview: string }): Promise<void> {
    return this.queueEmail({ to, subject: `Action required: Your ${data.entityType} needs review — EziHubb`, template: EmailTemplate.CONTENT_FLAGGED, data });
  }

  async sendContentRejectedCritical(to: string, data: { sellerName: string; violationCategory: string; contentPreview: string }): Promise<void> {
    return this.queueEmail({ to, subject: 'Important: Content removed from EziHubb — policy violation', template: EmailTemplate.CONTENT_REJECTED_CRITICAL, data });
  }

  async sendContentWarning(to: string, data: { sellerName: string; sellerMessage: string }): Promise<void> {
    return this.queueEmail({ to, subject: 'Heads up: Please review your recent content — EziHubb', template: EmailTemplate.CONTENT_WARNING, data });
  }

  async sendModerationCriticalAlert(to: string, data: { storeName: string; entityType: string; entityId: string; categories: string; confidence: string; reasoning: string | null; adminUrl: string; logId: string }): Promise<void> {
    return this.queueEmail({ to, subject: `🚨 CRITICAL: Content violation detected — ${data.storeName}`, template: EmailTemplate.MODERATION_CRITICAL_ALERT, data });
  }

  async sendStoreStrikeWarning(to: string, data: { sellerName: string; strikeCount: number; windowDays: number; maxStrikes: number; sellerDashboardUrl: string }): Promise<void> {
    return this.queueEmail({ to, subject: 'Warning: Your store has received multiple content violations', template: EmailTemplate.STORE_STRIKE_WARNING, data });
  }


  async subscribeNewsletter(email: string, firstName?: string): Promise<void> {
    const shopUrl = process.env['NEXT_PUBLIC_URL'] ?? 'http://localhost:3000';
    return this.queueEmail({
      to:       email,
      subject:  'Welcome to the EziHubb newsletter!',
      template: EmailTemplate.NEWSLETTER_WELCOME,
      data:     { firstName: firstName ?? 'Friend', shopUrl, year: new Date().getFullYear() },
    });
  }

  // ─── Buyer notification feed ───────────────────────────────────────────────
  //
  // The Notification table has existed with the right shape all along —
  // isRead, readAt, and indexes on [userId, isRead] and [userId, createdAt],
  // which is a feed schema and nothing else. There was simply no way to read
  // it: the controller exposed no GET at all, so rows could only ever go in.

  /**
   * One page of the caller's own notifications.
   *
   * userId comes from the JWT and is applied in the WHERE clause, never from
   * a parameter. There is no notification id in the route for a reason — a
   * caller must not be able to name someone else's row.
   */
  async listForUser(userId: string, opts: { limit?: number; before?: Date } = {}) {
    // Number.isFinite before clamping, not just ?? — the controller parses this
    // from a query string, so `?limit=abc` arrives as NaN. NaN survives both
    // Math.max and Math.min unchanged, so it would have reached Prisma as
    // `take: NaN` and thrown, turning a malformed query parameter into a 500.
    // A bad value falls back to the default rather than being rejected: the
    // caller asked for "some notifications", and the page size is not the part
    // worth failing the request over.
    const requested = Number(opts.limit);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 1), 50)
      : 20;
    const items = await this.prisma.notification.findMany({
      where: { userId, ...(opts.before ? { createdAt: { lt: opts.before } } : {}) },
      orderBy: { createdAt: 'desc' },
      // One extra row decides hasMore without a second count query.
      take: limit + 1,
    });
    const hasMore = items.length > limit;
    return { items: hasMore ? items.slice(0, limit) : items, hasMore };
  }

  /** Unread count for the bell badge. */
  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  /**
   * Marks one notification read.
   *
   * updateMany with userId in the WHERE, not findUnique-then-update: the
   * ownership check and the write are one statement, so there is no window
   * between them and no way to touch a row belonging to someone else. A
   * count of 0 means "not yours, or does not exist" — deliberately the same
   * answer, so this cannot be used to probe which ids exist.
   */
  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
  }

  /** Marks every unread notification read. Returns how many changed. */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
    return { updated: count };
  }

  /**
   * Creates a notification for one user.
   *
   * The single entry point for writing to this table, so callers cannot
   * repeat the mistake the product-availability handler made: it passed
   * `userId: null as any`, which the cast hid from the compiler and the
   * non-null foreign key rejected at runtime. Every insert failed.
   */
  async createForUser(input: {
    userId: string;
    type:   string;
    title:  string;
    body:   string;
    data?:  Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type:   input.type,
        title:  input.title,
        body:   input.body,
        ...(input.data ? { data: input.data as object } : {}),
      },
    });
  }
}
