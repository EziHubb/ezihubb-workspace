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
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUES.ORDER_PROCESSING) private readonly orderQueue: Queue,
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

      // Confirm order
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.CONFIRMED, confirmedAt: now },
      });

      // Record status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: OrderStatus.CONFIRMED,
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
        order: { select: { id: true, createdAt: true, orderNumber: true } },
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

    const updated = await this.prisma.payment.update({
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
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.REFUNDED },
      });
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: OrderStatus.REFUNDED,
          note: `Refunded $${refundAmount.toFixed(2)} — ${dto.reason ?? 'admin initiated'}`,
        },
      });
    }

    this.logger.log(
      `Refund ${refund.id} created for payment ${paymentId}, amount $${refundAmount}`,
    );

    return this.mapPaymentToDto(updated);
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
    return payments.map(this.mapPaymentToDto);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async fulfilWithGiftCard(
    orderId: string,
    giftCardCode: string,
    giftCardAmount: number,
    total: number,
  ): Promise<void> {
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
        data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.CONFIRMED,
          note: 'Paid in full with gift card',
        },
      });
    });
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

  private mapPaymentToDto(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
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
}
