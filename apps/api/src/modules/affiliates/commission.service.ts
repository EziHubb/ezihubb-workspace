import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CommissionStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS } from '../../queue/queue.constants';

const AUTO_CONFIRM_JOB = 'auto-confirm';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    @InjectQueue(QUEUES.AFFILIATE_COMMISSION) private readonly queue:      Queue,
    @InjectQueue(QUEUES.EMAIL)                private readonly emailQueue: Queue,
  ) {}

  // ── CREATE: called fire-and-forget after payment_intent.succeeded ──────────

  async createForOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where:  { id: orderId },
      select: {
        id:                     true,
        affiliateId:            true,
        subtotal:               true,
        discountAmount:         true,
        affiliateDiscountAmount: true,
        couponCode:             true,
        status:                 true,
      },
    });

    if (!order?.affiliateId) return;

    // Idempotency: one commission per order
    const existing = await this.prisma.affiliateCommission.findUnique({
      where: { orderId },
    });
    if (existing) {
      this.logger.debug(`Commission already exists for order ${orderId} — skipping`);
      return;
    }

    // Per-affiliate rate > global default > hard-coded fallback
    const [affiliate, settings] = await Promise.all([
      this.prisma.affiliateAccount.findUnique({
        where:  { id: order.affiliateId },
        select: { commissionRate: true },
      }),
      this.prisma.affiliateSettings.findUnique({
        where:  { id: 'singleton' },
        select: { defaultRate: true, lockDays: true },
      }),
    ]);

    const rate = Number(affiliate?.commissionRate ?? settings?.defaultRate ?? 0.10);

    // Base = subtotal minus coupon discount only; affiliate discount is not deducted
    const commissionBase = Math.max(
      0,
      Number(order.subtotal) - Number(order.discountAmount),
    );
    const commissionAmount = Math.round(commissionBase * rate * 100) / 100;

    await this.prisma.affiliateCommission.create({
      data: {
        affiliateId: order.affiliateId,
        orderId:     order.id,
        baseAmount:  commissionBase,
        rate,
        amount:      commissionAmount,
        status:      CommissionStatus.PENDING,
      },
    });

    this.logger.log(
      `Commission created: order=${orderId} affiliate=${order.affiliateId} amount=${commissionAmount} rate=${rate}`,
    );
  }

  // ── SCHEDULE: called when order → DELIVERED ────────────────────────────────

  async scheduleAutoConfirm(orderId: string): Promise<void> {
    const settings = await this.prisma.affiliateSettings.findUnique({
      where:  { id: 'singleton' },
      select: { lockDays: true },
    });
    const lockDays = settings?.lockDays ?? 14;
    const delay    = lockDays * 24 * 60 * 60 * 1_000;

    await this.queue.add(
      AUTO_CONFIRM_JOB,
      { orderId },
      {
        delay,
        jobId:             `confirm-${orderId}`,
        removeOnComplete:  true,
        removeOnFail:      50,
      },
    );

    this.logger.log(`Auto-confirm scheduled: order=${orderId} delay=${lockDays}d`);
  }

  // ── CONFIRM: PENDING → CONFIRMED, credit balance ──────────────────────────

  async confirmCommission(orderId: string): Promise<void> {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where:   { orderId },
      include: {
        order:     { select: { orderNumber: true } },
        affiliate: { select: { email: true, firstName: true } },
      },
    });
    if (!commission || commission.status !== CommissionStatus.PENDING) return;

    const settings = await this.prisma.affiliateSettings.findUnique({
      where:  { id: 'singleton' },
      select: { minPayoutAmount: true },
    });

    await this.prisma.$transaction([
      this.prisma.affiliateCommission.update({
        where: { id: commission.id },
        data:  { status: CommissionStatus.CONFIRMED, confirmedAt: new Date() },
      }),
      this.prisma.affiliateAccount.update({
        where: { id: commission.affiliateId },
        data:  {
          balance:     { increment: commission.amount },
          totalEarned: { increment: commission.amount },
        },
      }),
    ]);

    this.logger.log(
      `Commission confirmed: order=${orderId} affiliate=${commission.affiliateId} amount=${commission.amount}`,
    );

    // Fire-and-forget: commission confirmed email
    const shopUrl    = this.config.get<string>('FRONTEND_URL', 'https://dailydaisy.com');
    const amount     = Number(commission.amount);
    const minPayout  = Number(settings?.minPayoutAmount ?? 50);

    // Note: balance after increment is approximate (race-safe enough for display)
    const affiliate = await this.prisma.affiliateAccount.findUnique({
      where:  { id: commission.affiliateId },
      select: { balance: true },
    });
    const newBalance = Number(affiliate?.balance ?? 0);

    void this.emailQueue
      .add(JOBS.SEND_EMAIL, {
        to:       commission.affiliate.email,
        subject:  `You earned $${amount.toFixed(2)} — commission confirmed 💰`,
        template: 'commission-confirmed',
        data: {
          firstName:   commission.affiliate.firstName ?? 'there',
          amount:      amount.toFixed(2),
          orderNumber: commission.order.orderNumber,
          balance:     newBalance.toFixed(2),
          minPayout:   minPayout.toFixed(2),
          canPayout:   newBalance >= minPayout,
          payoutsUrl:  `${shopUrl}/affiliate/payouts`,
          shopUrl,
          year:        new Date().getFullYear(),
        },
      })
      .catch((err: Error) =>
        this.logger.warn(`Failed to queue commission-confirmed email: ${err.message}`),
      );
  }

  // ── CANCEL: called when order is REFUNDED ─────────────────────────────────

  async cancelCommission(orderId: string, reason: string): Promise<void> {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { orderId },
    });
    if (!commission) return;
    if (commission.status === CommissionStatus.PAID) {
      this.logger.warn(
        `Cannot cancel PAID commission for order=${orderId} — manual review required`,
      );
      return;
    }

    const wasConfirmed = commission.status === CommissionStatus.CONFIRMED;

    await this.prisma.$transaction([
      this.prisma.affiliateCommission.update({
        where: { id: commission.id },
        data:  {
          status:      CommissionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      }),
      ...(wasConfirmed
        ? [
            this.prisma.affiliateAccount.update({
              where: { id: commission.affiliateId },
              data:  {
                balance:     { decrement: commission.amount },
                totalEarned: { decrement: commission.amount },
              },
            }),
          ]
        : []),
    ]);

    const job = await this.queue.getJob(`confirm-${orderId}`);
    if (job) await job.remove();

    this.logger.log(
      `Commission cancelled: order=${orderId} reason="${reason}" wasConfirmed=${wasConfirmed}`,
    );
  }

  // ── PAYOUT: admin approves + marks PAID ───────────────────────────────────

  async processPayout(payoutId: string, adminId: string): Promise<void> {
    const payout = await this.prisma.affiliatePayout.findUnique({
      where:   { id: payoutId },
      include: { affiliate: { select: { balance: true } } },
    });
    if (!payout || payout.status !== 'REQUESTED') return;

    if (Number(payout.affiliate.balance) < Number(payout.amount)) {
      throw new BadRequestException({
        code:    'ERR_PAYOUT_INSUFFICIENT_BALANCE',
        message: 'Payout amount exceeds affiliate balance',
      });
    }

    await this.prisma.$transaction([
      this.prisma.affiliatePayout.update({
        where: { id: payoutId },
        data:  {
          status:        'PAID',
          processedAt:   new Date(),
          processedById: adminId,
        },
      }),
      this.prisma.affiliateAccount.update({
        where: { id: payout.affiliateId },
        data:  { balance: { decrement: payout.amount } },
      }),
      this.prisma.affiliateCommission.updateMany({
        where: { affiliateId: payout.affiliateId, status: CommissionStatus.CONFIRMED },
        data:  { status: CommissionStatus.PAID },
      }),
    ]);

    this.logger.log(
      `Payout processed: payout=${payoutId} affiliate=${payout.affiliateId} amount=${payout.amount} by=${adminId}`,
    );
  }
}
