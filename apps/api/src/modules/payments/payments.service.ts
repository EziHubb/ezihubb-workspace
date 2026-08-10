import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import {
  JOBS,
  QUEUES,
  SendEmailJobData,
  OrderConfirmedJobData,
  DEFAULT_JOB_OPTIONS,
  FULFILLMENT_JOB_OPTIONS,
} from '../../queue/queue.constants';
import {
  CreatePaymentIntentDto,
  PaymentIntentResponseDto,
} from './dto/create-payment-intent.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import {
  PaymentResponseDto,
  GiftCardResponseDto,
} from './dto/payment-response.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { CommissionService } from '../affiliates/commission.service';
import { LowStockService } from '../products/low-stock.service';
import { ReferralService } from '../referrals/referral.service';

const WEBHOOK_IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds
const REFUND_WINDOW_DAYS = 60;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly analyticsService: AnalyticsService,
    private readonly commissionService: CommissionService,
    private readonly lowStockService: LowStockService,
    private readonly referralService: ReferralService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUES.ORDER_PROCESSING) private readonly orderQueue: Queue,
    @InjectQueue(QUEUES.FULFILLMENT) private readonly fulfillmentQueue: Queue,
  ) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-04-22.dahlia' as const,
    });
  }

  // ─── Payment Intent ───────────────────────────────────────────────────────

  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    return this.createPaymentIntentForOrder(dto.orderId, dto.giftCardCode);
  }

  async createPaymentIntentForOrder(
    orderId: string,
    giftCardCode?: string,
  ): Promise<PaymentIntentResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Order not found',
      });

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException({
        code: 'ERR_ORDER_INVALID_STATE',
        message: 'Order is not awaiting payment',
      });
    }

    let stripeAmount = Number(order.total);
    let giftCardApplied = 0;

    if (giftCardCode) {
      const giftCard = await this.prisma.giftCard.findFirst({
        where: { code: giftCardCode, isActive: true },
      });

      if (!giftCard)
        throw new BadRequestException({
          code: 'ERR_GIFT_CARD_INVALID',
          message: 'Invalid or inactive gift card',
        });
      if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
        throw new BadRequestException({
          code: 'ERR_GIFT_CARD_EXPIRED',
          message: 'Gift card has expired',
        });
      }
      if (Number(giftCard.balance) <= 0) {
        throw new BadRequestException({
          code: 'ERR_GIFT_CARD_NO_BALANCE',
          message: 'Gift card has no remaining balance',
        });
      }

      giftCardApplied = Math.min(Number(giftCard.balance), stripeAmount);
      stripeAmount = Math.max(0, stripeAmount - giftCardApplied);
    }

    const currency = 'usd';

    // If gift card covers 100%, no Stripe charge needed
    if (stripeAmount < 0.5 && giftCardCode) {
      // Stripe minimum is $0.50; treat as fully covered by gift card
      // Create a gift-card-only payment record and confirm order
      await this.fulfilWithGiftCard(
        orderId,
        giftCardCode,
        giftCardApplied,
        Number(order.total),
      );
      return { clientSecret: '', amount: 0, currency };
    }

    // Create Stripe PaymentIntent — server never sees raw card data (PCI compliant)
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(stripeAmount * 100), // cents
      currency,
      metadata: {
        orderId,
        orderNumber: order.orderNumber,
      },
    });

    // Upsert payment record
    const method: PaymentMethod = giftCardCode
      ? PaymentMethod.MIXED
      : PaymentMethod.STRIPE;
    await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        method,
        status: PaymentStatus.PENDING,
        amount: order.total,
        currency,
        stripePaymentIntentId: intent.id,
        giftCardCode: giftCardCode ?? null,
        giftCardAmount: giftCardApplied > 0 ? giftCardApplied : null,
      },
      update: {
        stripePaymentIntentId: intent.id,
        method,
        giftCardCode: giftCardCode ?? null,
        giftCardAmount: giftCardApplied > 0 ? giftCardApplied : null,
      },
    });

    return {
      clientSecret: intent.client_secret!,
      amount: stripeAmount,
      currency,
    };
  }

  // ─── Stripe Webhook ────────────────────────────────────────────────────────

  async handleStripeWebhook(event: any): Promise<void> {
    // Idempotency: process each event exactly once
    const idempotencyKey = `stripe:webhook:${event.id}`;
    const client = this.redis.getClient();
    const acquired = await client.set(
      idempotencyKey,
      '1',
      'EX',
      WEBHOOK_IDEMPOTENCY_TTL,
      'NX',
    );
    if (!acquired) {
      this.logger.log(`Skipping duplicate webhook event ${event.id}`);
      return;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.onPaymentIntentSucceeded(
            event.data.object as any,
          );
          break;
        case 'payment_intent.payment_failed':
          await this.onPaymentIntentFailed(
            event.data.object as any,
          );
          break;
        case 'charge.refunded':
          await this.onChargeRefunded(event.data.object as any);
          break;
        default:
          this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (err) {
      // Release idempotency lock so the event can be retried
      await client.del(idempotencyKey);
      throw err;
    }
  }

  private async onPaymentIntentSucceeded(
    intent: any,
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intent.id },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn(`No payment record for PaymentIntent ${intent.id}`);
      return;
    }

    if (payment.status === PaymentStatus.PAID) return; // Already processed

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Confirm payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: now,
          stripeChargeId: intent.latest_charge as string | null,
        },
      });

      // Apply gift card if used
      if (payment.giftCardCode && payment.giftCardAmount) {
        await this.deductGiftCard(
          tx,
          payment.giftCardCode,
          Number(payment.giftCardAmount),
          payment.orderId,
        );
      }

      // Confirm order. A digital order has no shipping/tracking stages — payment
      // success IS delivery, so it goes straight to COMPLETED (which also
      // immediately satisfies the review-eligibility check and unlocks downloads,
      // since access is derived live from Order.status, not a separate grant).
      const confirmedStatus = payment.order.isDigital ? OrderStatus.COMPLETED : OrderStatus.CONFIRMED;
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: confirmedStatus, confirmedAt: now },
      });

      // Record status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: confirmedStatus,
          note: 'Payment confirmed',
        },
      });

      // Clear cart
      if (payment.order.userId) {
        await tx.cart.updateMany({
          where: { userId: payment.order.userId },
          data: { couponCode: null, discountAmount: null },
        });
        await tx.cartItem.deleteMany({
          where: { cart: { userId: payment.order.userId } },
        });
      }
    });

    // ── Confirm StoreOrders and notify sellers ─────────────────────────────
    this.confirmStoreOrders(payment.orderId).catch((err: Error) =>
      this.logger.error(`StoreOrder confirmation failed for order ${payment.orderId}: ${err.message}`),
    );

    // Queue notifications outside transaction
    const customerEmail =
      payment.order.guestEmail ??
      (await this.getUserEmail(payment.order.userId));
    if (customerEmail) {
      await this.emailQueue.add(
        JOBS.SEND_EMAIL,
        {
          to: customerEmail,
          template: 'order-confirmed',
          subject: `Order ${payment.order.orderNumber} Confirmed`,
          data: { orderNumber: payment.order.orderNumber },
        } satisfies SendEmailJobData,
        DEFAULT_JOB_OPTIONS,
      );

      if (payment.order.isDigital) {
        const shopUrl = this.config.get<string>('NEXT_PUBLIC_URL') ?? 'https://ezihubb.com';
        await this.emailQueue.add(
          JOBS.SEND_EMAIL,
          {
            to: customerEmail,
            template: 'digital-download-ready',
            subject: `Your files are ready — Order ${payment.order.orderNumber}`,
            data: {
              orderNumber: payment.order.orderNumber,
              downloadUrl: `${shopUrl.replace(/\/$/, '')}/orders/${payment.order.orderNumber}`,
              year: new Date().getFullYear(),
            },
          } satisfies SendEmailJobData,
          DEFAULT_JOB_OPTIONS,
        );
      }
    }

    await this.orderQueue.add(
      JOBS.ORDER_CONFIRMED,
      {
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        customerEmail: customerEmail ?? '',
      } satisfies OrderConfirmedJobData,
      DEFAULT_JOB_OPTIONS,
    );

    // Fire-and-forget commission — must not throw or block the webhook response
    this.commissionService
      .createForOrder(payment.orderId)
      .catch((err: Error) =>
        this.logger.error(`Commission creation failed for order ${payment.orderId}: ${err.message}`),
      );

    // Fire-and-forget referral commission
    this.referralService
      .createCommissionsForOrder(payment.orderId)
      .catch((err: Error) =>
        this.logger.error(`Referral commission creation failed for order ${payment.orderId}: ${err.message}`),
      );

    // Fire-and-forget low-stock inventory check
    this.lowStockService
      .checkAfterOrder(payment.orderId)
      .catch((err: Error) =>
        this.logger.warn(`Low-stock check failed for order ${payment.orderId}: ${err.message}`),
      );

    // Fire-and-forget analytics — must not throw or block the webhook response
    this.prisma.order
      .findUnique({
        where: { id: payment.orderId },
        select: {
          orderNumber: true,
          total: true,
          items: { select: { productId: true, productName: true, quantity: true, unitPrice: true } },
        },
      })
      .then((o) => {
        if (!o) return;
        const orderData = {
          id: payment.orderId,
          orderNumber: o.orderNumber,
          total: Number(o.total),
          items: o.items.map((i) => ({ productId: i.productId ?? '', quantity: i.quantity })),
        };
        return Promise.all([
          this.analyticsService.trackOrderConfirmed(orderData),
          this.analyticsService.sendToGA4(payment.orderId, [
            {
              name: 'purchase',
              params: {
                transaction_id: o.orderNumber,
                value: Number(o.total),
                currency: 'USD',
                items: o.items.map((i) => ({
                  item_id:   i.productId,
                  item_name: i.productName,
                  price:     Number(i.unitPrice),
                  quantity:  i.quantity,
                })),
              },
            },
          ]),
        ]);
      })
      .catch((err: Error) =>
        this.logger.warn(`Analytics tracking failed for order ${payment.orderId}: ${err.message}`),
      );
  }

  // ─── StoreOrder confirmation (fire-and-forget after payment) ────────────

  private async confirmStoreOrders(orderId: string): Promise<void> {
    const storeOrders = await this.prisma.storeOrder.findMany({
      where:   { orderId },
      include: { store: { include: { owner: { select: { email: true, firstName: true } } } } },
    });

    for (const so of storeOrders) {
      // Both writes must land together — a crash between them would confirm
      // the order without crediting the store's stats, or vice versa.
      await this.prisma.$transaction([
        this.prisma.storeOrder.update({
          where: { id: so.id },
          data:  { status: 'CONFIRMED' },
        }),
        this.prisma.store.update({
          where: { id: so.storeId },
          data:  {
            totalOrders:   { increment: 1 },
            totalRevenue:  { increment: Number(so.sellerEarnings) },
          },
        }),
      ]);

      // Notify seller of new order
      if (so.store.owner?.email) {
        await this.emailQueue.add(JOBS.SEND_EMAIL, {
          to:       so.store.owner.email,
          template: 'new-store-order',
          subject:  `New order for ${so.store.name}`,
          data: {
            firstName:  so.store.owner.firstName,
            storeName:  so.store.name,
            orderId:    so.id,
            earnings:   Number(so.sellerEarnings).toFixed(2),
          },
        }, DEFAULT_JOB_OPTIONS);
      }

      // Push to a connected fulfillment provider (e.g. Printify) if any of this
      // store's items are mapped — no-op inside the job if none are.
      await this.fulfillmentQueue.add(
        JOBS.PUSH_STORE_ORDER,
        { storeOrderId: so.id },
        FULFILLMENT_JOB_OPTIONS,
      );
    }
  }

  private async onPaymentIntentFailed(
    intent: any,
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intent.id },
    });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });

    this.logger.warn(
      `Payment failed for order ${payment.orderId}, intent ${intent.id}: ${intent.last_payment_error?.message ?? 'unknown'}`,
    );
  }

  private async onChargeRefunded(charge: any): Promise<void> {
    if (!charge.payment_intent) return;
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: charge.payment_intent as string },
    });
    if (!payment) return;

    const totalRefunded = charge.amount_refunded / 100;
    const isFullRefund = totalRefunded >= Number(payment.amount);

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: totalRefunded,
        status: isFullRefund
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED,
        refundedAt: new Date(),
      },
    });
  }

  // ─── Refunds ──────────────────────────────────────────────────────────────

  async createRefund(
    paymentId: string,
    dto: CreateRefundDto,
  ): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: { select: { id: true, createdAt: true, orderNumber: true, isDigital: true } },
      },
    });

    if (!payment)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Payment not found',
      });

    // 60-day refund window
    const refundCutoff = new Date(
      payment.order.createdAt.getTime() +
        REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1_000,
    );
    if (new Date() > refundCutoff) {
      throw new BadRequestException({
        code: 'ERR_REFUND_WINDOW_EXPIRED',
        message: 'Refund window of 60 days has passed',
      });
    }

    if (
      payment.status !== PaymentStatus.PAID &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException({
        code: 'ERR_REFUND_INVALID_STATE',
        message: 'Payment is not in a refundable state',
      });
    }

    const alreadyRefunded = Number(payment.refundedAmount);
    const maxRefundable = Number(payment.amount) - alreadyRefunded;

    if (maxRefundable <= 0) {
      throw new BadRequestException({
        code: 'ERR_REFUND_ALREADY_FULL',
        message: 'Payment has already been fully refunded',
      });
    }

    const refundAmount = dto.amount ?? maxRefundable;

    if (refundAmount > maxRefundable) {
      throw new BadRequestException({
        code: 'ERR_REFUND_EXCEEDS_MAX',
        message: `Maximum refundable amount is $${maxRefundable.toFixed(2)}`,
      });
    }

    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException({
        code: 'ERR_REFUND_NOT_STRIPE',
        message: 'Cannot refund non-Stripe payment via this endpoint',
      });
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount: Math.round(refundAmount * 100),
      reason: 'requested_by_customer',
    });

    const newRefundedTotal = alreadyRefunded + refundAmount;
    const isFullRefund = newRefundedTotal >= Number(payment.amount) - 0.01;

    // The Stripe call above can't be inside a DB transaction (external API),
    // but everything after it — Payment + Order + OrderStatusHistory — must
    // land together or not at all, otherwise a crash between them leaves a
    // payment marked REFUNDED with the order stuck in its pre-refund status.
    const updated = await this.prisma.$transaction(async (tx) => {
      const paymentUpdate = await tx.payment.update({
        where: { id: paymentId },
        data: {
          refundedAmount: newRefundedTotal,
          status: isFullRefund
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED,
          refundedAt: new Date(),
          refundReason: dto.reason ?? null,
        },
      });

      if (isFullRefund) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.REFUNDED },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: OrderStatus.REFUNDED,
            note: `Refunded $${refundAmount.toFixed(2)} — ${dto.reason ?? 'admin initiated'}`,
          },
        });
      }

      return paymentUpdate;
    });

    if (isFullRefund) {
      // Cancel any affiliate commission — fire-and-forget
      this.commissionService
        .cancelCommission(payment.orderId, `Order refunded — ${dto.reason ?? 'admin initiated'}`)
        .catch((err: Error) =>
          this.logger.error(`Commission cancellation failed for order ${payment.orderId}: ${err.message}`),
        );

      // Cancel referral commissions — fire-and-forget
      this.referralService
        .cancelCommissionsForOrder(payment.orderId, `Order refunded — ${dto.reason ?? 'admin initiated'}`)
        .catch((err: Error) =>
          this.logger.error(`Referral commission cancel failed for order ${payment.orderId}: ${err.message}`),
        );

    }

    this.logger.log(
      `Refund ${refund.id} created for payment ${paymentId}, amount $${refundAmount}`,
    );

    return this.mapPaymentToDto(updated, payment.order.isDigital);
  }

  // ─── Gift Card Purchase ───────────────────────────────────────────────────

  async purchaseGiftCard(
    dto: {
      amount: number;
      recipientEmail: string;
      recipientName?: string;
      personalMessage?: string;
      paymentMethodId: string;
    },
    buyerUserId?: string,
  ): Promise<{ giftCardCode: string; amount: number; recipientEmail: string }> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(dto.amount * 100),
      currency: 'usd',
      payment_method: dto.paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: `Gift card purchase — $${dto.amount} for ${dto.recipientEmail}`,
      metadata: {
        type: 'gift_card_purchase',
        buyerUserId: buyerUserId ?? 'guest',
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException({
        code: 'ERR_PAYMENT_FAILED',
        message: 'Payment did not succeed. Please try again.',
      });
    }

    const code = this.generateGiftCardCode();

    const giftCard = await this.prisma.giftCard.create({
      data: {
        code,
        initialValue: dto.amount,
        balance: dto.amount,
        isActive: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        recipientEmail: dto.recipientEmail,
        recipientName: dto.recipientName,
        personalMessage: dto.personalMessage,
        purchasedByUserId: buyerUserId,
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    await this.emailQueue.add(
      JOBS.SEND_EMAIL,
      {
        to: dto.recipientEmail,
        template: 'gift-card-delivery',
        subject: `You've received a $${dto.amount} EziHubb Gift Card!`,
        data: {
          recipientName: dto.recipientName ?? 'Friend',
          code: giftCard.code,
          amount: dto.amount,
          message: dto.personalMessage ?? null,
          expiresAt: giftCard.expiresAt!.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          shopUrl:
            this.config.get<string>('NEXT_PUBLIC_URL') ??
            'https://ezihubb.com',
          year: new Date().getFullYear(),
        },
      } satisfies SendEmailJobData,
      DEFAULT_JOB_OPTIONS,
    );

    this.logger.log(
      `Gift card purchased: code=${giftCard.code} amount=${dto.amount} recipient=${dto.recipientEmail}`,
    );

    return {
      giftCardCode: giftCard.code,
      amount: dto.amount,
      recipientEmail: dto.recipientEmail,
    };
  }

  private generateGiftCardCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segment = () =>
      Array.from(
        { length: 4 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join('');
    return `MLH-${segment()}-${segment()}-${segment()}`;
  }

  // ─── Gift Cards ───────────────────────────────────────────────────────────

  async validateGiftCard(code: string): Promise<GiftCardResponseDto> {
    const card = await this.prisma.giftCard.findFirst({
      where: { code, isActive: true },
    });
    if (!card)
      throw new NotFoundException({
        code: 'ERR_GIFT_CARD_INVALID',
        message: 'Gift card not found or inactive',
      });
    return {
      code: card.code,
      balance: Number(card.balance),
      initialValue: Number(card.initialValue),
      isActive: card.isActive,
      expiresAt: card.expiresAt,
    };
  }

  async applyGiftCard(
    code: string,
    orderId: string,
  ): Promise<{
    appliedAmount: number;
    remainingOrderTotal: number;
    fullyPaid: boolean;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Order not found',
      });
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException({
        code: 'ERR_ORDER_INVALID_STATE',
        message: 'Order is not awaiting payment',
      });
    }

    const card = await this.prisma.giftCard.findFirst({
      where: { code, isActive: true },
    });
    if (!card)
      throw new NotFoundException({
        code: 'ERR_GIFT_CARD_INVALID',
        message: 'Gift card not found or inactive',
      });

    const orderTotal = Number(order.total);
    const cardBalance = Number(card.balance);
    const appliedAmount = Math.min(cardBalance, orderTotal);

    if (cardBalance >= orderTotal) {
      // Gift card covers the full order
      await this.fulfilWithGiftCard(orderId, code, orderTotal, orderTotal);
      return {
        appliedAmount: orderTotal,
        remainingOrderTotal: 0,
        fullyPaid: true,
      };
    }

    // Partial payment — deduct available balance; caller still needs a PaymentIntent
    await this.prisma.$transaction(async (tx) => {
      await this.deductGiftCard(tx, code, appliedAmount, orderId);
    });
    return {
      appliedAmount,
      remainingOrderTotal: orderTotal - appliedAmount,
      fullyPaid: false,
    };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async listPayments(page = 1, limit = 20): Promise<PaymentResponseDto[]> {
    const payments = await this.prisma.payment.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.mapPaymentToDto(p));
  }

  async getStats(): Promise<{
    totalRevenue: number;
    pendingPayouts: number;
    refundedAmount: number;
    successRate: number;
  }> {
    const [paid, pending, refunded, total] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.PAID },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.PENDING },
      }),
      this.prisma.payment.aggregate({
        _sum: { refundedAmount: true },
        where: { status: { in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] } },
      }),
      this.prisma.payment.count(),
    ]);

    const paidCount = await this.prisma.payment.count({ where: { status: PaymentStatus.PAID } });

    return {
      totalRevenue:    Number(paid._sum.amount ?? 0),
      pendingPayouts:  Number(pending._sum.amount ?? 0),
      refundedAmount:  Number(refunded._sum.refundedAmount ?? 0),
      successRate:     total > 0 ? Math.round((paidCount / total) * 100) : 0,
    };
  }

  async getRefunds(paymentId: string): Promise<{
    paymentId: string;
    refundedAmount: number;
    refundedAt: Date | null;
    status: string;
  }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Payment not found' });
    }
    return {
      paymentId:      payment.id,
      refundedAmount: Number(payment.refundedAmount ?? 0),
      refundedAt:     payment.refundedAt ?? null,
      status:         payment.status,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async fulfilWithGiftCard(
    orderId: string,
    giftCardCode: string,
    giftCardAmount: number,
    total: number,
  ): Promise<void> {
    // A 100%-gift-card order never touches onPaymentIntentSucceeded (Stripe) or
    // the PayPal capture handler — it's a third, independent completion path,
    // so digital orders need the exact same isDigital branch here or they get
    // stuck at CONFIRMED forever (no download access, no delivery email).
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { orderNumber: true, isDigital: true, userId: true, guestEmail: true },
    });
    const confirmedStatus = order.isDigital ? OrderStatus.COMPLETED : OrderStatus.CONFIRMED;

    await this.prisma.$transaction(async (tx) => {
      await this.deductGiftCard(tx, giftCardCode, giftCardAmount, orderId);
      await tx.payment.create({
        data: {
          orderId,
          method: PaymentMethod.GIFT_CARD,
          status: PaymentStatus.PAID,
          amount: total,
          currency: 'usd',
          giftCardCode,
          giftCardAmount,
          paidAt: new Date(),
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: confirmedStatus, confirmedAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: confirmedStatus,
          note: 'Paid in full with gift card',
        },
      });
    });

    // Gift card confirmed order — create commission if affiliated
    this.commissionService
      .createForOrder(orderId)
      .catch((err: Error) =>
        this.logger.error(`Commission creation failed for gift-card order ${orderId}: ${err.message}`),
      );

    // Gift card confirmed order — create referral commission
    this.referralService
      .createCommissionsForOrder(orderId)
      .catch((err: Error) =>
        this.logger.error(`Referral commission creation failed for gift-card order ${orderId}: ${err.message}`),
      );

    if (order.isDigital) {
      const customerEmail = order.guestEmail ?? (await this.getUserEmail(order.userId));
      if (customerEmail) {
        const shopUrl = this.config.get<string>('NEXT_PUBLIC_URL') ?? 'https://ezihubb.com';
        await this.emailQueue.add(
          JOBS.SEND_EMAIL,
          {
            to: customerEmail,
            template: 'digital-download-ready',
            subject: `Your files are ready — Order ${order.orderNumber}`,
            data: {
              orderNumber: order.orderNumber,
              downloadUrl: `${shopUrl.replace(/\/$/, '')}/orders/${order.orderNumber}`,
              year: new Date().getFullYear(),
            },
          } satisfies SendEmailJobData,
          DEFAULT_JOB_OPTIONS,
        );
      }
    }
  }

  private async deductGiftCard(
    tx: Prisma.TransactionClient,
    code: string,
    amount: number,
    orderId: string,
  ): Promise<void> {
    // Atomic deduction — balance cannot go negative
    const result = await tx.giftCard.updateMany({
      where: { code, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });

    if (result.count === 0) {
      throw new BadRequestException({
        code: 'ERR_GIFT_CARD_INSUFFICIENT',
        message: 'Gift card has insufficient balance',
      });
    }

    // Card must exist since the deduction above succeeded
    const card = await tx.giftCard.findUniqueOrThrow({
      where: { code },
      select: { id: true },
    });
    await tx.giftCardUsage.create({
      data: { giftCardId: card.id, orderId, amount },
    });
  }

  private async getUserEmail(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }

  private mapPaymentToDto(payment: Payment, orderIsDigital?: boolean): PaymentResponseDto {
    return {
      id: payment.id,
      orderIsDigital,
      orderId: payment.orderId,
      method: payment.method,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      stripeChargeId: payment.stripeChargeId,
      paypalOrderId: payment.paypalOrderId,
      giftCardCode: payment.giftCardCode,
      giftCardAmount: payment.giftCardAmount
        ? Number(payment.giftCardAmount)
        : null,
      refundedAmount: Number(payment.refundedAmount),
      refundedAt: payment.refundedAt,
      refundReason: payment.refundReason,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }

  // ── PayPal webhook event handler ─────────────────────────────────────────────

  async handlePaypalWebhookEvent(
    eventType: string,
    resource: Record<string, unknown>,
    eventId: string,
  ): Promise<void> {
    // Idempotency — skip if already processed
    if (eventId) {
      const existing = await this.prisma.payment.findFirst({
        where: { providerEventId: eventId },
      });
      if (existing) {
        this.logger.debug(`PayPal event ${eventId} already processed — skipping`);
        return;
      }
    }

    switch (eventType) {

      // ── Buyer approved order (before capture) ──────────────────────────────
      case 'CHECKOUT.ORDER.APPROVED': {
        const paypalOrderId = resource['id'] as string | undefined;
        const purchaseUnits = resource['purchase_units'] as { custom_id?: string }[] | undefined;
        const customId      = purchaseUnits?.[0]?.custom_id; // internal orderId

        if (!paypalOrderId || !customId) break;

        await this.prisma.payment.updateMany({
          where:  { orderId: customId, method: PaymentMethod.PAYPAL },
          data:   { paypalOrderId, ...(eventId ? { providerEventId: eventId } : {}) },
        });
        this.logger.log(`PayPal: order ${paypalOrderId} approved for order ${customId}`);
        break;
      }

      // ── Payment captured successfully ───────────────────────────────────────
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const captureId      = resource['id'] as string | undefined;
        const suppData       = resource['supplementary_data'] as { related_ids?: { order_id?: string } } | undefined;
        const paypalOrderId  = suppData?.related_ids?.order_id;

        const payment = await this.prisma.payment.findFirst({
          where: {
            OR: [
              ...(paypalOrderId ? [{ paypalOrderId }] : []),
              ...(captureId     ? [{ paypalCaptureId: captureId }] : []),
            ],
          },
          include: { order: { include: { user: true } } },
        });

        if (!payment) {
          this.logger.warn(`PayPal CAPTURE.COMPLETED: no payment for captureId=${captureId}`);
          break;
        }

        // Already captured + idempotency event saved — true duplicate
        if (payment.status === PaymentStatus.PAID && payment.providerEventId) break;

        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status:          PaymentStatus.PAID,
              paypalCaptureId: captureId,
              paidAt:          now,
              ...(eventId ? { providerEventId: eventId } : {}),
            },
          });

          const confirmedStatus = payment.order.isDigital ? OrderStatus.COMPLETED : OrderStatus.CONFIRMED;
          if (payment.order.status !== confirmedStatus) {
            await tx.order.update({
              where: { id: payment.orderId },
              data:  { status: confirmedStatus, confirmedAt: now },
            });
            await tx.orderStatusHistory.create({
              data: { orderId: payment.orderId, status: confirmedStatus, note: 'PayPal payment captured' },
            });
          }
        });

        // ── Fire-and-forget: email ──────────────────────────────────────────
        const customer = payment.order.user;
        const customerEmail = customer?.email ?? (payment.order as any).guestEmail as string | null;
        if (customerEmail) {
          await this.emailQueue.add(
            JOBS.SEND_EMAIL,
            {
              to:       customerEmail,
              template: 'order-confirmation',
              subject:  `Order confirmed — #${payment.order.orderNumber}`,
              data: {
                firstName:   customer?.firstName ?? 'there',
                orderNumber: payment.order.orderNumber,
                total:       Number(payment.order.total).toFixed(2),
                shopUrl:     process.env['NEXT_PUBLIC_URL'] ?? '',
              },
            } satisfies SendEmailJobData,
            DEFAULT_JOB_OPTIONS,
          );

          if (payment.order.isDigital) {
            const shopUrl = process.env['NEXT_PUBLIC_URL'] ?? 'https://ezihubb.com';
            await this.emailQueue.add(
              JOBS.SEND_EMAIL,
              {
                to: customerEmail,
                template: 'digital-download-ready',
                subject: `Your files are ready — Order ${payment.order.orderNumber}`,
                data: {
                  orderNumber: payment.order.orderNumber,
                  downloadUrl: `${shopUrl.replace(/\/$/, '')}/orders/${payment.order.orderNumber}`,
                  year: new Date().getFullYear(),
                },
              } satisfies SendEmailJobData,
              DEFAULT_JOB_OPTIONS,
            );
          }
        }
        await this.orderQueue.add(
          JOBS.ORDER_CONFIRMED,
          { orderId: payment.orderId, orderNumber: payment.order.orderNumber, customerEmail: customerEmail ?? '' } satisfies OrderConfirmedJobData,
          DEFAULT_JOB_OPTIONS,
        );

        // ── Fire-and-forget: commission ─────────────────────────────────────
        this.commissionService
          .createForOrder(payment.orderId)
          .catch((err: Error) =>
            this.logger.error(`PayPal commission failed for order ${payment.orderId}: ${err.message}`),
          );

        this.referralService
          .createCommissionsForOrder(payment.orderId)
          .catch((err: Error) =>
            this.logger.error(`PayPal referral commission failed for order ${payment.orderId}: ${err.message}`),
          );

        this.logger.log(`PayPal CAPTURE.COMPLETED: order ${payment.orderId} CONFIRMED`);
        break;
      }

      // ── Payment refunded ────────────────────────────────────────────────────
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const refundAmount = parseFloat(
          (resource['amount'] as { value?: string } | undefined)?.value ?? '0',
        );
        // captureId is in the "up" link
        const links     = resource['links'] as { rel: string; href: string }[] | undefined;
        const captureId = links?.find((l) => l.rel === 'up')?.href?.split('/').pop();

        const payment = await this.prisma.payment.findFirst({
          where: { paypalCaptureId: captureId },
        });

        if (!payment) {
          this.logger.warn(`PayPal REFUNDED: no payment for captureId=${captureId}`);
          break;
        }

        await this.prisma.$transaction([
          this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status:         PaymentStatus.REFUNDED,
              refundedAmount: refundAmount,
              refundedAt:     new Date(),
              ...(eventId ? { providerEventId: eventId } : {}),
            },
          }),
          this.prisma.order.update({
            where: { id: payment.orderId },
            data:  { status: OrderStatus.REFUNDED },
          }),
        ]);

        this.commissionService
          .cancelCommission(payment.orderId, 'Order refunded via PayPal')
          .catch((err: Error) =>
            this.logger.error(`PayPal commission cancel failed: ${err.message}`),
          );

        this.referralService
          .cancelCommissionsForOrder(payment.orderId, 'Order refunded via PayPal')
          .catch((err: Error) =>
            this.logger.error(`PayPal referral commission cancel failed: ${err.message}`),
          );

        this.logger.log(`PayPal REFUNDED: order ${payment.orderId}`);
        break;
      }

      // ── Payment denied / failed ─────────────────────────────────────────────
      case 'PAYMENT.CAPTURE.DENIED': {
        const suppData      = resource['supplementary_data'] as { related_ids?: { order_id?: string } } | undefined;
        const paypalOrderId = suppData?.related_ids?.order_id;

        const payment = await this.prisma.payment.findFirst({
          where: { paypalOrderId },
        });

        if (!payment) break;

        // Only update Payment — Order stays PENDING_PAYMENT so user can retry
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            ...(eventId ? { providerEventId: eventId } : {}),
          },
        });

        this.logger.warn(`PayPal DENIED: payment ${payment.id} for order ${payment.orderId} → FAILED`);
        break;
      }

      default:
        this.logger.debug(`PayPal webhook: unhandled event type ${eventType}`);
    }
  }
}
