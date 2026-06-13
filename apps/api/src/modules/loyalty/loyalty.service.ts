import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { LOYALTY_CONFIG } from './loyalty.config';

const AUTO_CONFIRM_JOB = 'loyalty-confirm';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly config:       ConfigService,
    private readonly pushService:  PushService,
    @InjectQueue(QUEUES.LOYALTY) private readonly queue:      Queue,
    @InjectQueue(QUEUES.EMAIL)   private readonly emailQueue: Queue,
  ) {}

  // ── Get or create account ─────────────────────────────────────────────────

  async getOrCreateAccount(
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const existing = await client.loyaltyAccount.findUnique({ where: { userId } });
    if (existing) return existing;
    return client.loyaltyAccount.create({ data: { userId } });
  }

  // ── Public summary ────────────────────────────────────────────────────────

  async getAccountSummary(userId: string) {
    const account = await this.getOrCreateAccount(userId);
    const transactions = await this.prisma.loyaltyTransaction.findMany({
      where:   { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    return {
      pointsBalance:  account.pointsBalance,
      pointsPending:  account.pointsPending,
      pointsLifetime: account.pointsLifetime,
      transactions:   transactions.map((t) => ({
        id:          t.id,
        type:        t.type,
        points:      t.points,
        description: t.description,
        orderId:     t.orderId,
        confirmedAt: t.confirmedAt,
        createdAt:   t.createdAt,
      })),
    };
  }

  // ── Validate redemption (pre-checkout) ────────────────────────────────────

  async validateRedemption(
    userId:       string,
    pointsToRedeem: number,
    orderTotal:   number,
  ): Promise<{ pointsDiscount: number }> {
    if (pointsToRedeem < LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
      throw new BadRequestException({
        code:    'ERR_LOYALTY_MIN_REDEEM',
        message: `Minimum redemption is ${LOYALTY_CONFIG.MIN_REDEEM_POINTS} points`,
      });
    }

    const maxDiscount = Math.floor(orderTotal * LOYALTY_CONFIG.MAX_REDEEM_PERCENT * 100) / 100;
    const requestedDiscount = pointsToRedeem * LOYALTY_CONFIG.POINT_VALUE;
    if (requestedDiscount > maxDiscount) {
      throw new BadRequestException({
        code:    'ERR_LOYALTY_MAX_REDEEM',
        message: `Points can cover at most 50% of order total ($${maxDiscount.toFixed(2)})`,
      });
    }

    const account = await this.prisma.loyaltyAccount.findUnique({ where: { userId } });
    if (!account || account.pointsBalance < pointsToRedeem) {
      throw new BadRequestException({
        code:    'ERR_LOYALTY_INSUFFICIENT_BALANCE',
        message: 'Insufficient points balance',
      });
    }

    return { pointsDiscount: Math.round(requestedDiscount * 100) / 100 };
  }

  // ── Redeem at checkout (inside $transaction) ──────────────────────────────

  async redeemPoints(
    userId:    string,
    orderId:   string,
    points:    number,
    tx:        Prisma.TransactionClient,
  ): Promise<void> {
    // Atomic deduction — balance cannot go negative
    const result = await tx.loyaltyAccount.updateMany({
      where: { userId, pointsBalance: { gte: points } },
      data:  { pointsBalance: { decrement: points } },
    });

    if (result.count === 0) {
      throw new BadRequestException({
        code:    'ERR_LOYALTY_INSUFFICIENT_BALANCE',
        message: 'Insufficient points balance',
      });
    }

    const account = await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    await tx.loyaltyTransaction.create({
      data: {
        accountId:   account.id,
        orderId,
        type:        LoyaltyTxType.REDEEM,
        points:      -points,
        description: `Redeemed ${points} pts at checkout`,
      },
    });
  }

  // ── Earn (called after payment confirmed) ─────────────────────────────────

  async earnPoints(
    userId:        string,
    orderId:       string,
    earnableTotal: number,   // order total minus pointsDiscount (don't earn on redeemed points)
  ): Promise<void> {
    const pointsEarned = Math.floor(earnableTotal * LOYALTY_CONFIG.POINTS_PER_DOLLAR);
    if (pointsEarned <= 0) return;

    const account = await this.getOrCreateAccount(userId);

    await this.prisma.$transaction([
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data:  {
          pointsPending:  { increment: pointsEarned },
          pointsLifetime: { increment: pointsEarned },
        },
      }),
      this.prisma.loyaltyTransaction.create({
        data: {
          accountId:   account.id,
          orderId,
          type:        LoyaltyTxType.EARN,
          points:      pointsEarned,
          description: `Earned ${pointsEarned} pts from order`,
        },
      }),
      // Store pointsEarned on the order for reference
      this.prisma.order.update({
        where: { id: orderId },
        data:  { pointsEarned },
      }),
    ]);

    this.logger.log(`Loyalty earned: user=${userId} order=${orderId} pts=${pointsEarned}`);
  }

  // ── Schedule confirm (called when order → DELIVERED) ─────────────────────

  async schedulePointsConfirm(orderId: string, userId: string): Promise<void> {
    const delay = LOYALTY_CONFIG.LOCK_DAYS * 24 * 60 * 60 * 1_000;

    await this.queue.add(
      AUTO_CONFIRM_JOB,
      { orderId, userId },
      {
        delay,
        jobId:            `loyalty-confirm-${orderId}`,
        removeOnComplete: true,
        removeOnFail:     50,
      },
    );

    this.logger.log(`Loyalty confirm scheduled: order=${orderId} delay=${LOYALTY_CONFIG.LOCK_DAYS}d`);
  }

  // ── Confirm (called by BullMQ after lock period) ──────────────────────────

  async confirmPoints(orderId: string, userId: string): Promise<void> {
    const earnTx = await this.prisma.loyaltyTransaction.findFirst({
      where: { orderId, type: LoyaltyTxType.EARN, confirmedAt: null },
    });
    if (!earnTx) {
      this.logger.debug(`No pending EARN tx for order=${orderId} — skipping confirm`);
      return;
    }

    const pointsEarned = earnTx.points; // positive
    if (pointsEarned <= 0) return;

    await this.prisma.$transaction([
      this.prisma.loyaltyAccount.update({
        where: { userId },
        data:  {
          pointsPending: { decrement: pointsEarned },
          pointsBalance: { increment: pointsEarned },
        },
      }),
      this.prisma.loyaltyTransaction.update({
        where: { id: earnTx.id },
        data:  { confirmedAt: new Date() },
      }),
    ]);

    this.logger.log(`Loyalty confirmed: order=${orderId} user=${userId} pts=${pointsEarned}`);

    // Fire-and-forget email
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, firstName: true },
    });
    if (!user) return;

    const account = await this.prisma.loyaltyAccount.findUnique({
      where:  { userId },
      select: { pointsBalance: true },
    });

    const shopUrl = this.config.get<string>('FRONTEND_URL', 'https://dailydaisy.com');

    void this.emailQueue
      .add(JOBS.SEND_EMAIL, {
        to:       user.email,
        subject:  `You earned ${pointsEarned} loyalty points! 🎉`,
        template: 'loyalty-points-earned',
        data: {
          firstName:     user.firstName ?? 'Valued Customer',
          points:        pointsEarned,
          balance:       account?.pointsBalance ?? pointsEarned,
          dollarValue:   (pointsEarned * LOYALTY_CONFIG.POINT_VALUE).toFixed(2),
          loyaltyUrl:    `${shopUrl}/account/loyalty`,
          shopUrl,
          year:          new Date().getFullYear(),
        },
      })
      .catch((err: Error) =>
        this.logger.warn(`Failed to queue loyalty points email: ${err.message}`),
      );

    // Push notification (fire-and-forget)
    this.pushService
      .notifyPointsConfirmed(userId, pointsEarned)
      .catch((err: Error) =>
        this.logger.warn(`Failed to send push for points confirm: ${err.message}`),
      );
  }

  // ── Cancel (called on refund) ─────────────────────────────────────────────

  async cancelPoints(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where:  { id: orderId },
      select: { userId: true, pointsEarned: true, pointsRedeemed: true },
    });

    if (!order?.userId) return;

    const userId = order.userId;
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // 1 — cancel earned points (pending or confirmed)
    if (order.pointsEarned && order.pointsEarned > 0) {
      const earnTx = await this.prisma.loyaltyTransaction.findFirst({
        where: { orderId, type: LoyaltyTxType.EARN },
      });

      if (earnTx) {
        const wasConfirmed = earnTx.confirmedAt !== null;
        ops.push(
          this.prisma.loyaltyAccount.update({
            where: { userId },
            data: wasConfirmed
              ? { pointsBalance: { decrement: earnTx.points } }
              : { pointsPending: { decrement: earnTx.points } },
          }),
          this.prisma.loyaltyTransaction.create({
            data: {
              accountId:   earnTx.accountId,
              orderId,
              type:        LoyaltyTxType.CANCEL,
              points:      -earnTx.points,
              description: `Earned pts cancelled: order refunded`,
            },
          }),
        );
      }
    }

    // 2 — restore redeemed points
    if (order.pointsRedeemed && order.pointsRedeemed > 0) {
      const account = await this.prisma.loyaltyAccount.findUnique({ where: { userId } });
      if (account) {
        ops.push(
          this.prisma.loyaltyAccount.update({
            where: { userId },
            data:  { pointsBalance: { increment: order.pointsRedeemed } },
          }),
          this.prisma.loyaltyTransaction.create({
            data: {
              accountId:   account.id,
              orderId,
              type:        LoyaltyTxType.ADJUST,
              points:      order.pointsRedeemed,
              description: `Redeemed pts restored: order refunded`,
            },
          }),
        );
      }
    }

    if (ops.length > 0) {
      await this.prisma.$transaction(ops);
    }

    // Remove the pending BullMQ confirm job (no longer needed)
    const job = await this.queue.getJob(`loyalty-confirm-${orderId}`);
    if (job) await job.remove();

    this.logger.log(`Loyalty cancelled: order=${orderId} user=${userId}`);
  }
}
