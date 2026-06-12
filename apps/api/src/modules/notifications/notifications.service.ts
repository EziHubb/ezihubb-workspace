import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { fmtDate } from '@mlh/utils';

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
  BUYER_REFERRAL_INVITE:      'buyer-referral-invite',
  BUYER_REFERRAL_CREDITED:    'buyer-referral-credited',
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
  ) {}

  async queueEmail(options: QueueEmailOptions): Promise<void> {
    await this.emailQueue.add(JOBS.SEND_EMAIL, options, DEFAULT_JOB_OPTIONS);
    this.logger.debug(`Queued email: template="${options.template}" to="${options.to}"`);
  }

  // ── Specific email helpers ────────────────────────────────────────────────────

  async sendWelcomeEmail(to: string, firstName?: string): Promise<void> {
    return this.queueEmail({
      to,
      subject: 'Welcome to Maple Loom Handmade!',
      template: EmailTemplate.WELCOME,
      data: { firstName: firstName ?? 'Valued Customer' },
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
    const supportEmail = process.env['SUPPORT_EMAIL'] ?? 'support@mapleloomhandmade.com';
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
      subject:  'We received your message — MapleLoomHandmade',
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
    const adminEmail  = process.env['ADMIN_EMAIL'] ?? 'admin@mapleloomhandmade.com';
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
      subject:  'MapleLoomHandmade replied to your message',
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
    return this.queueEmail({ to, subject: `Action required: Your ${data.entityType} needs review — MapleLoom`, template: EmailTemplate.CONTENT_FLAGGED, data });
  }

  async sendContentRejectedCritical(to: string, data: { sellerName: string; violationCategory: string; contentPreview: string }): Promise<void> {
    return this.queueEmail({ to, subject: 'Important: Content removed from MapleLoom — policy violation', template: EmailTemplate.CONTENT_REJECTED_CRITICAL, data });
  }

  async sendContentWarning(to: string, data: { sellerName: string; sellerMessage: string }): Promise<void> {
    return this.queueEmail({ to, subject: 'Heads up: Please review your recent content — MapleLoom', template: EmailTemplate.CONTENT_WARNING, data });
  }

  async sendModerationCriticalAlert(to: string, data: { storeName: string; entityType: string; entityId: string; categories: string; confidence: string; reasoning: string | null; adminUrl: string; logId: string }): Promise<void> {
    return this.queueEmail({ to, subject: `🚨 CRITICAL: Content violation detected — ${data.storeName}`, template: EmailTemplate.MODERATION_CRITICAL_ALERT, data });
  }

  async sendStoreStrikeWarning(to: string, data: { sellerName: string; strikeCount: number; windowDays: number; maxStrikes: number; sellerDashboardUrl: string }): Promise<void> {
    return this.queueEmail({ to, subject: 'Warning: Your store has received multiple content violations', template: EmailTemplate.STORE_STRIKE_WARNING, data });
  }

  async sendBuyerReferralInvite(data: {
    email: string; firstName: string; creditAmount: number;
    cookieToken: string; expiresAt: Date;
  }) {
    const baseUrl = this.config.get<string>('CLIENT_URL', 'https://mapleloom.com');
    return this.queueEmail({
      to:       data.email,
      subject:  `Share your order & earn $${data.creditAmount} store credit`,
      template: EmailTemplate.BUYER_REFERRAL_INVITE,
      data: {
        firstName:    data.firstName,
        creditAmount: data.creditAmount,
        referralUrl:  `${baseUrl}?bref=${data.cookieToken}`,
        expiresAt:    fmtDate(data.expiresAt),
        year:         new Date().getFullYear(),
      },
    });
  }

  async sendBuyerReferralCredited(data: {
    email: string; firstName: string; creditAmount: number; expiresAt: Date;
  }) {
    return this.queueEmail({
      to:       data.email,
      subject:  `Your friend just bought! You earned $${data.creditAmount} credit 🎉`,
      template: EmailTemplate.BUYER_REFERRAL_CREDITED,
      data: {
        firstName:    data.firstName,
        creditAmount: data.creditAmount,
        expiresAt:    fmtDate(data.expiresAt),
        year:         new Date().getFullYear(),
      },
    });
  }

  async subscribeNewsletter(email: string, firstName?: string): Promise<void> {
    return this.queueEmail({
      to:       email,
      subject:  'Welcome to the Maple Loom newsletter!',
      template: 'newsletter-welcome' as any,
      data:     { firstName: firstName ?? 'Friend', year: new Date().getFullYear() },
    });
  }
}
