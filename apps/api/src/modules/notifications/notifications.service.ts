import { Injectable, Logger } from '@nestjs/common';
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
      data: { ...order },
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
}
