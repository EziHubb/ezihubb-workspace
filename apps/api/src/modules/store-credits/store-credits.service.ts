import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';

@Injectable()
export class StoreCreditsService {
  private readonly logger = new Logger(StoreCreditsService.name);
  private readonly DEFAULT_CREDIT_AMOUNT = new Prisma.Decimal(4);
  private readonly CREDIT_EXPIRY_DAYS    = 90;
  private readonly REFERRAL_WINDOW_DAYS  = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── Called after order CONFIRMED: create BuyerReferral record ─────────────

  async createBuyerReferralForOrder(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { id: true, email: true, firstName: true } },
          storeOrders: {
            orderBy: { subtotal: 'desc' },
            take: 1,
            include: { store: { select: { id: true, buyerReferralCredit: true } } },
          },
        },
      });
      if (!order?.userId || !order.user) return;

      const primaryStoreOrder = order.storeOrders[0];
      if (!primaryStoreOrder) return;

      const existing = await this.prisma.buyerReferral.findFirst({
        where: { referrerOrderId: orderId },
      });
      if (existing) return;

      const creditAmount =
        primaryStoreOrder.store.buyerReferralCredit ?? this.DEFAULT_CREDIT_AMOUNT;

      const expiresAt = new Date(
        Date.now() + this.REFERRAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );

      const referral = await this.prisma.buyerReferral.create({
        data: {
          referrerUserId:  order.userId,
          referrerOrderId: order.id,
          storeId:         primaryStoreOrder.store.id,
          cookieToken:     crypto.randomUUID(),
          creditAmount:    creditAmount,
          expiresAt,
        },
      });

      await this.notifications.sendBuyerReferralInvite({
        email:        order.user.email,
        firstName:    order.user.firstName ?? 'there',
        creditAmount: Number(creditAmount),
        cookieToken:  referral.cookieToken,
        expiresAt,
      });
    } catch (err) {
      this.logger.error(`createBuyerReferralForOrder failed for ${orderId}`, err);
    }
  }

  // ── Called after friend's order CONFIRMED: credit the referrer ────────────

  async processBuyerReferral(friendOrderId: string, cookieToken: string | null | undefined): Promise<void> {
    if (!cookieToken || !/^[0-9a-f-]{36}$/.test(cookieToken)) return;
    try {
      const referral = await this.prisma.buyerReferral.findFirst({
        where: {
          cookieToken,
          status:    'PENDING',
          expiresAt: { gt: new Date() },
        },
      });
      if (!referral) return;

      const friendOrder = await this.prisma.order.findUnique({
        where: { id: friendOrderId },
        select: { userId: true },
      });
      if (!friendOrder?.userId) return;

      // No self-referral
      if (friendOrder.userId === referral.referrerUserId) return;

      const referrer = await this.prisma.user.findUnique({
        where: { id: referral.referrerUserId },
        select: { email: true, firstName: true },
      });
      if (!referrer) return;

      await this.prisma.$transaction([
        this.prisma.storeCredit.create({
          data: {
            userId:          referral.referrerUserId,
            storeId:         referral.storeId,
            amount:          referral.creditAmount,
            expiresAt:       new Date(Date.now() + this.CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
            reason:          'BUYER_REFERRAL',
            sourceOrderId:   friendOrderId,
            referrerOrderId: referral.referrerOrderId,
          },
        }),
        this.prisma.buyerReferral.update({
          where: { id: referral.id },
          data: {
            status:         'CREDITED',
            referredUserId: friendOrder.userId,
            referredOrderId: friendOrderId,
          },
        }),
      ]);

      await this.notifications.sendBuyerReferralCredited({
        email:        referrer.email,
        firstName:    referrer.firstName ?? 'there',
        creditAmount: Number(referral.creditAmount),
        expiresAt:    new Date(Date.now() + this.CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      });
    } catch (err) {
      this.logger.error(`processBuyerReferral failed for order ${friendOrderId}`, err);
    }
  }

  // ── Get buyer referral link for an order ─────────────────────────────────

  async getBuyerReferralForOrder(orderNumber: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      select: { id: true },
    });
    if (!order) return null;

    return this.prisma.buyerReferral.findFirst({
      where: { referrerOrderId: order.id },
      select: { cookieToken: true, creditAmount: true, expiresAt: true, status: true },
    });
  }

  // ── Get user's available store credits ───────────────────────────────────

  async getUserStoreCredits(userId: string) {
    const credits = await this.prisma.storeCredit.findMany({
      where: { userId, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
      select: { id: true, storeId: true, amount: true, expiresAt: true, reason: true, createdAt: true },
    });

    const total = credits.reduce(
      (sum, c) => sum.plus(new Prisma.Decimal(c.amount.toString())),
      new Prisma.Decimal(0),
    );

    return { credits, total: total.toNumber() };
  }

  // ── Consume store credit inside a Prisma transaction ─────────────────────

  async consumeStoreCredit(
    tx: Prisma.TransactionClient,
    userId: string,
    storeId: string,
    amount: Prisma.Decimal,
    orderId: string,
  ): Promise<Prisma.Decimal> {
    const credits = await tx.storeCredit.findMany({
      where: { userId, storeId, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });

    let consumed = new Prisma.Decimal(0);
    let remaining = amount;

    for (const credit of credits) {
      if (remaining.lte(0)) break;
      const creditAmt = new Prisma.Decimal(credit.amount.toString());
      consumed = consumed.plus(creditAmt.gt(remaining) ? remaining : creditAmt);
      remaining = remaining.minus(creditAmt).lt(0) ? new Prisma.Decimal(0) : remaining.minus(creditAmt);
      await tx.storeCredit.update({
        where: { id: credit.id },
        data: { isUsed: true, usedAt: new Date(), usedInOrderId: orderId },
      });
    }

    return consumed;
  }

  // ── Daily cron: expire stale BuyerReferral records ───────────────────────

  async expireStaleReferrals(): Promise<void> {
    await this.prisma.buyerReferral.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data:  { status: 'EXPIRED' },
    });
  }
}
