import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { ReferralCommissionStatus } from '@prisma/client';
import type { ReferralRequestPayoutDto as RequestPayoutDto } from './dto/referral.dto';

const MAX_TREE_DEPTH = 3;

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.REFERRAL) private readonly referralQueue: Queue,
  ) {}

  // ── Code generation ─────────────────────────────────────────────────────────

  generateCode(firstName: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const prefix = (firstName ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, chars[Math.floor(Math.random() * 26)]);
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return prefix + suffix;
  }

  async generateUniqueCode(firstName: string, retries = 5): Promise<string> {
    for (let i = 0; i < retries; i++) {
      const code = this.generateCode(firstName);
      const exists = await this.prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
      if (!exists) return code;
    }
    // Fallback: random 8-char code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // ── Register hook ───────────────────────────────────────────────────────────

  async handleNewUserRegistered(
    userId: string,
    firstName: string,
    referralCodeUsed?: string,
  ): Promise<void> {
    const code = await this.generateUniqueCode(firstName);

    let referredByUserId: string | null = null;
    let referralDepth = 0;

    if (referralCodeUsed) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: referralCodeUsed },
        select: { id: true, referralDepth: true },
      });
      if (referrer && referrer.id !== userId) {
        referredByUserId = referrer.id;
        referralDepth = (referrer.referralDepth ?? 0) + 1;
        if (referralDepth > 5) referralDepth = 5; // hard cap

        // Increment referrer's totalReferrals
        await this.prisma.user.update({
          where: { id: referrer.id },
          data: { totalReferrals: { increment: 1 } },
        });

        // Check tier upgrade (fire-and-forget)
        this.checkAndUpdateTier(referrer.id).catch((err: Error) =>
          this.logger.error(`Tier check failed for ${referrer.id}: ${err.message}`),
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code, referredByUserId, referralDepth },
    });
  }

  // ── Tree walker ─────────────────────────────────────────────────────────────

  async getUplineChain(
    startUserId: string,
    maxDepth = MAX_TREE_DEPTH,
  ): Promise<Array<{ userId: string; level: number }>> {
    const chain: Array<{ userId: string; level: number }> = [];
    let currentId: string | null = startUserId;
    let level = 1;

    while (currentId && level <= maxDepth) {
      const found: { referredByUserId: string | null } | null = await this.prisma.user.findUnique({
        where: { id: currentId },
        select: { referredByUserId: true },
      });
      if (!found?.referredByUserId) break;
      chain.push({ userId: found.referredByUserId, level });
      currentId = found.referredByUserId;
      level++;
    }

    return chain;
  }

  // ── Commission creation ─────────────────────────────────────────────────────

  async createCommissionsForOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, referralUserId: true, subtotal: true },
    });

    if (!order?.referralUserId) return;

    // Idempotency: if any commission already exists for this order, skip
    const existing = await this.prisma.referralCommission.count({ where: { orderId } });
    if (existing > 0) return;

    const settings = await this.prisma.referralSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.isEnabled) return;

    const baseAmount = Number(order.subtotal);
    const buyerId = order.userId!;
    const rates = [
      Number(settings.level1Rate),
      Number(settings.level2Rate),
      Number(settings.level3Rate),
    ];

    // Level 1 = referralUserId (direct referrer), then walk upline
    const level1 = { userId: order.referralUserId, level: 1 };

    // Get upline from the referralUser (not the buyer) — walk from referralUser upward
    const upline = await this.getUplineChain(order.referralUserId, MAX_TREE_DEPTH - 1);
    const chain = [level1, ...upline.map((u) => ({ userId: u.userId, level: u.level + 1 }))];

    for (const { userId: earnerId, level } of chain) {
      if (level > MAX_TREE_DEPTH) break;
      if (earnerId === buyerId) continue; // buyer cannot earn from own order

      const rate = rates[level - 1] ?? 0;
      if (rate <= 0) continue;

      // Apply tier bonus
      const earner = await this.prisma.user.findUnique({
        where: { id: earnerId },
        select: { referralTier: { select: { commissionBonus: true } } },
      });
      const bonus = Number(earner?.referralTier?.commissionBonus ?? 0);
      const effectiveRate = rate + bonus;
      const amount = Math.round(baseAmount * effectiveRate * 100) / 100;

      await this.prisma.referralCommission.create({
        data: {
          id: `rc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          earnerId,
          orderId,
          buyerId,
          level,
          rate: effectiveRate,
          baseAmount,
          amount,
          status: ReferralCommissionStatus.PENDING,
        },
      });

      // Update earner balance (pending)
      await this.prisma.user.update({
        where: { id: earnerId },
        data: {
          referralBalance: { increment: amount },
          referralEarned:  { increment: amount },
        },
      });
    }
  }

  // ── Auto-confirm after lock period ─────────────────────────────────────────

  async scheduleAutoConfirm(orderId: string): Promise<void> {
    const settings = await this.prisma.referralSettings.findUnique({ where: { id: 'singleton' } });
    const lockDays = settings?.lockDays ?? 14;
    const delay = lockDays * 24 * 60 * 60 * 1_000;
    await this.referralQueue.add(
      JOBS.REFERRAL_AUTO_CONFIRM,
      { orderId },
      { ...DEFAULT_JOB_OPTIONS, delay, jobId: `ref-confirm-${orderId}` },
    );
  }

  async confirmCommissionsForOrder(orderId: string): Promise<void> {
    const commissions = await this.prisma.referralCommission.findMany({
      where: { orderId, status: ReferralCommissionStatus.PENDING },
    });

    for (const commission of commissions) {
      await this.prisma.referralCommission.update({
        where: { id: commission.id },
        data: { status: ReferralCommissionStatus.CONFIRMED, confirmedAt: new Date() },
      });

      await this.checkAndUpdateTier(commission.earnerId).catch(() => {});
    }
  }

  // ── Cancel on refund ────────────────────────────────────────────────────────

  async cancelCommissionsForOrder(orderId: string, reason: string): Promise<void> {
    const commissions = await this.prisma.referralCommission.findMany({
      where: {
        orderId,
        status: { in: [ReferralCommissionStatus.PENDING, ReferralCommissionStatus.CONFIRMED] },
      },
    });

    for (const commission of commissions) {
      await this.prisma.referralCommission.update({
        where: { id: commission.id },
        data: {
          status: ReferralCommissionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      // Deduct from balance
      await this.prisma.user.update({
        where: { id: commission.earnerId },
        data: {
          referralBalance: { decrement: Number(commission.amount) },
          referralEarned:  { decrement: Number(commission.amount) },
        },
      });
    }

    // Remove scheduled confirm job
    const job = await this.referralQueue.getJob(`ref-confirm-${orderId}`);
    if (job) await job.remove();
  }

  // ── Tier management ─────────────────────────────────────────────────────────

  async checkAndUpdateTier(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalReferrals: true, referralEarned: true, referralTierId: true },
    });
    if (!user) return;

    const tiers = await this.prisma.referralTier.findMany({ orderBy: { sortOrder: 'desc' } });
    const earned = Number(user.referralEarned);
    const refs = user.totalReferrals;

    const eligibleTier = tiers.find(
      (t) => refs >= t.minReferrals && earned >= Number(t.minEarned),
    );

    if (eligibleTier?.id !== user.referralTierId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { referralTierId: eligibleTier?.id ?? null },
      });
    }
  }

  // ── Payout ──────────────────────────────────────────────────────────────────

  async requestPayout(userId: string, dto: RequestPayoutDto): Promise<void> {
    const settings = await this.prisma.referralSettings.findUnique({ where: { id: 'singleton' } });
    const minPayout = Number(settings?.minPayoutAmount ?? 50);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralBalance: true },
    });
    if (!user) throw new BadRequestException({ code: 'ERR_NOT_FOUND', message: 'User not found' });

    const balance = Number(user.referralBalance);
    if (balance < minPayout) {
      throw new BadRequestException({
        code: 'ERR_PAYOUT_MINIMUM',
        message: `Minimum payout is $${minPayout}. Your balance is $${balance.toFixed(2)}`,
      });
    }
    if (dto.amount > balance) {
      throw new BadRequestException({ code: 'ERR_PAYOUT_EXCEEDS_BALANCE', message: 'Amount exceeds balance' });
    }

    await this.prisma.referralPayout.create({
      data: {
        id: `rp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        amount:        dto.amount,
        paymentMethod: dto.paymentMethod,
        paymentDetail: dto.paymentDetail,
        updatedAt:     new Date(),
      },
    });
  }

  // ── Resolver for checkout ────────────────────────────────────────────────────

  async resolveCode(code: string): Promise<{ discountRate: number; referrerFirstName: string } | null> {
    if (!code || !/^[A-Z0-9]{4,12}$/.test(code.toUpperCase())) return null;

    const settings = await this.prisma.referralSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.isEnabled || !settings.buyerDiscountEnabled) return null;

    const user = await this.prisma.user.findUnique({
      where: { referralCode: code.toUpperCase() },
      select: { id: true, firstName: true },
    });
    if (!user) return null;

    return {
      discountRate:      Number(settings.buyerDiscountRate),
      referrerFirstName: user.firstName ?? 'Someone',
    };
  }

  // ── Account data ────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode:    true,
        referralBalance: true,
        referralEarned:  true,
        totalReferrals:  true,
        referralDepth:   true,
        referralTier:    true,
      },
    });
    if (!user) throw new BadRequestException({ code: 'ERR_NOT_FOUND', message: 'User not found' });

    const settings = await this.prisma.referralSettings.findUnique({ where: { id: 'singleton' } });
    const allTiers = await this.prisma.referralTier.findMany({ orderBy: { sortOrder: 'asc' } });

    const currentTierIdx = allTiers.findIndex((t) => t.id === user.referralTier?.id);
    const nextTier = currentTierIdx >= 0 ? allTiers[currentTierIdx + 1] ?? null : allTiers[0] ?? null;

    return {
      referralCode:    user.referralCode ?? '',
      referralBalance: Number(user.referralBalance),
      referralEarned:  Number(user.referralEarned),
      totalReferrals:  user.totalReferrals,
      referralDepth:   user.referralDepth,
      tier: user.referralTier
        ? {
            id:              user.referralTier.id,
            name:            user.referralTier.name,
            badgeColor:      user.referralTier.badgeColor,
            badgeIcon:       user.referralTier.badgeIcon,
            commissionBonus: Number(user.referralTier.commissionBonus),
            minReferrals:    user.referralTier.minReferrals,
            minEarned:       Number(user.referralTier.minEarned),
            sortOrder:       user.referralTier.sortOrder,
          }
        : null,
      nextTier: nextTier
        ? {
            id:           nextTier.id,
            name:         nextTier.name,
            minReferrals: nextTier.minReferrals,
            minEarned:    Number(nextTier.minEarned),
            sortOrder:    nextTier.sortOrder,
          }
        : null,
      settings: settings
        ? {
            level1Rate:           Number(settings.level1Rate),
            level2Rate:           Number(settings.level2Rate),
            level3Rate:           Number(settings.level3Rate),
            buyerDiscountRate:    Number(settings.buyerDiscountRate),
            buyerDiscountEnabled: settings.buyerDiscountEnabled,
            minPayoutAmount:      Number(settings.minPayoutAmount),
            lockDays:             settings.lockDays,
            isEnabled:            settings.isEnabled,
          }
        : null,
    };
  }

  async getMyCommissions(
    userId: string,
    page: number,
    limit: number,
    status?: ReferralCommissionStatus,
  ) {
    const where = { earnerId: userId, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.referralCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order:  { select: { orderNumber: true } },
          buyer:  { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.referralCommission.count({ where }),
    ]);

    return {
      data: items.map((c) => ({
        id:          c.id,
        level:       c.level,
        rate:        Number(c.rate),
        baseAmount:  Number(c.baseAmount),
        amount:      Number(c.amount),
        status:      c.status,
        confirmedAt: c.confirmedAt,
        createdAt:   c.createdAt,
        orderNumber: c.order.orderNumber,
        buyer: { firstName: c.buyer.firstName, lastName: c.buyer.lastName },
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMyPayouts(userId: string) {
    return this.prisma.referralPayout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyTree(userId: string) {
    const directs = await this.prisma.user.findMany({
      where: { referredByUserId: userId },
      select: { id: true, firstName: true, lastName: true, createdAt: true, referralCode: true, totalReferrals: true },
      orderBy: { createdAt: 'desc' },
    });
    return directs;
  }

  // ── Creator-branded getMe (field aliases + level counts) ────────────────────

  async getCreatorMe(userId: string) {
    const base = await this.getMe(userId);
    const levels = await this.getLevelCounts(userId);

    const pendingAmount = await this.prisma.referralCommission.aggregate({
      where: { earnerId: userId, status: ReferralCommissionStatus.PENDING },
      _sum: { amount: true },
    });
    const pendingBalance = Number(pendingAmount._sum.amount ?? 0);
    const confirmedBalance = Math.max(0, base.referralBalance - pendingBalance);

    return {
      ...base,
      // Creator-friendly aliases
      creatorCode:      base.referralCode,
      directReferrals:  levels.level1,
      level2Referrals:  levels.level2,
      level3Referrals:  levels.level3,
      totalEarned:      base.referralEarned,
      pendingBalance,
      confirmedBalance,
      tier: base.tier
        ? {
            ...base.tier,
            commissionRate: Number(base.settings?.level1Rate ?? 0) + Number(base.tier.commissionBonus),
          }
        : null,
    };
  }

  // ── Public stats for landing page ────────────────────────────────────────────

  async getPublicStats() {
    const [totalCreators, ordersGenerated, payoutAggregate, earnerAggregate] = await Promise.all([
      this.prisma.user.count({ where: { referralCode: { not: null }, totalReferrals: { gt: 0 } } }),
      this.prisma.referralCommission.count({ where: { status: { not: 'CANCELLED' } } }),
      this.prisma.referralPayout.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.referralCommission.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { amount: true },
        _count: { earnerId: true },
      }),
    ]);

    const totalPaidOut = Number(payoutAggregate._sum.amount ?? 0);
    const totalEarned  = Number(earnerAggregate._sum.amount ?? 0);
    const avgEarningsPerCreator = totalCreators > 0 ? totalEarned / totalCreators : 0;

    return { totalCreators, ordersGenerated, totalPaidOut, avgEarningsPerCreator };
  }

  async getCreatorEarnings(
    userId: string,
    page: number,
    limit: number,
    status?: ReferralCommissionStatus,
  ) {
    const result = await this.getMyCommissions(userId, page, limit, status);
    return {
      data: result.data.map((c) => ({
        ...c,
        type:    c.level === 1 ? 'DIRECT' : 'NETWORK',
        orderId: c.orderNumber,
      })),
      total: result.meta.total,
      page:  result.meta.page,
      totalPages: result.meta.totalPages,
    };
  }

  async getCreatorWithdrawals(userId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.referralPayout.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.referralPayout.count({ where: { userId } }),
    ]);
    return { data: items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // Count referrals at each level
  async getLevelCounts(userId: string): Promise<{ level1: number; level2: number; level3: number }> {
    const level1Users = await this.prisma.user.findMany({
      where: { referredByUserId: userId },
      select: { id: true },
    });
    const level1Ids = level1Users.map((u) => u.id);

    const level2Users = level1Ids.length
      ? await this.prisma.user.findMany({
          where: { referredByUserId: { in: level1Ids } },
          select: { id: true },
        })
      : [];
    const level2Ids = level2Users.map((u) => u.id);

    const level3Count = level2Ids.length
      ? await this.prisma.user.count({ where: { referredByUserId: { in: level2Ids } } })
      : 0;

    return { level1: level1Ids.length, level2: level2Ids.length, level3: level3Count };
  }
}
