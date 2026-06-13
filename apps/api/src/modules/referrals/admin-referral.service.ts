import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralPayoutStatus, ReferralCommissionStatus } from '@prisma/client';
import type { AdminBalanceAdjustDto, AdminTierDto, AdminReferralSettingsDto } from './dto/referral.dto';

@Injectable()
export class AdminReferralService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Overview KPIs ────────────────────────────────────────────────────────────

  async getOverview() {
    const [
      totalReferrers,
      monthlyActive,
      totalPaidOut,
      pendingCommissions,
      confirmedCommissions,
      topReferrers,
      recentCommissions,
    ] = await Promise.all([
      this.prisma.user.count({ where: { totalReferrals: { gt: 0 } } }),
      this.prisma.user.count({
        where: {
          referralCommissions: {
            some: {
              createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
              status: { not: ReferralCommissionStatus.CANCELLED },
            },
          },
        },
      }),
      this.prisma.referralPayout.aggregate({
        where: { status: ReferralPayoutStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.referralCommission.aggregate({
        where: { status: ReferralCommissionStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.referralCommission.aggregate({
        where: { status: ReferralCommissionStatus.CONFIRMED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.user.findMany({
        where: { totalReferrals: { gt: 0 } },
        orderBy: { referralEarned: 'desc' },
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          referralCode: true,
          totalReferrals: true,
          referralEarned: true,
          referralBalance: true,
          referralTier: { select: { name: true, badgeColor: true, badgeIcon: true } },
        },
      }),
      this.prisma.referralCommission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          earner: { select: { firstName: true, lastName: true, email: true } },
          buyer:  { select: { firstName: true, lastName: true } },
          order:  { select: { orderNumber: true } },
        },
      }),
    ]);

    return {
      kpis: {
        totalReferrers,
        monthlyActive,
        totalPaidOut: Number(totalPaidOut._sum.amount ?? 0),
        pendingCommissions: {
          count:  pendingCommissions._count,
          amount: Number(pendingCommissions._sum.amount ?? 0),
        },
        confirmedCommissions: {
          count:  confirmedCommissions._count,
          amount: Number(confirmedCommissions._sum.amount ?? 0),
        },
      },
      topReferrers: topReferrers.map((u) => ({
        id:             u.id,
        name:           `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        email:          u.email,
        referralCode:   u.referralCode,
        totalReferrals: u.totalReferrals,
        earned:         Number(u.referralEarned),
        balance:        Number(u.referralBalance),
        tier:           u.referralTier,
      })),
      recentCommissions: recentCommissions.map((c) => ({
        id:          c.id,
        earner:      `${c.earner.firstName ?? ''} ${c.earner.lastName ?? ''}`.trim(),
        buyer:       `${c.buyer.firstName ?? ''} ${c.buyer.lastName ?? ''}`.trim(),
        orderNumber: c.order.orderNumber,
        level:       c.level,
        amount:      Number(c.amount),
        status:      c.status,
        createdAt:   c.createdAt,
      })),
    };
  }

  // ── Users ────────────────────────────────────────────────────────────────────

  async listUsers(page: number, limit: number, search?: string, tierId?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { referralCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (tierId) where.referralTierId = tierId;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { referralEarned: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          referralCode: true,
          totalReferrals: true,
          referralBalance: true,
          referralEarned: true,
          referralDepth: true,
          referralTier: { select: { id: true, name: true, badgeColor: true, badgeIcon: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        ...u,
        referralBalance: Number(u.referralBalance),
        referralEarned:  Number(u.referralEarned),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserTree(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'User not found' });

    const buildLevel = async (parentId: string, level: number): Promise<any[]> => {
      if (level > 3) return [];
      const refs = await this.prisma.user.findMany({
        where: { referredByUserId: parentId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      return Promise.all(
        refs.map(async (u) => ({
          userId:    u.id,
          email:     u.email,
          firstName: u.firstName,
          lastName:  u.lastName,
          level,
          children:  await buildLevel(u.id, level + 1),
        })),
      );
    };

    return buildLevel(userId, 1);
  }

  async adjustBalance(userId: string, dto: AdminBalanceAdjustDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { referralBalance: true } });
    if (!user) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'User not found' });

    const newBalance = Number(user.referralBalance) + dto.delta;
    if (newBalance < 0) throw new BadRequestException({ code: 'ERR_BALANCE_NEGATIVE', message: 'Balance cannot go negative' });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        referralBalance: { increment: dto.delta },
        ...(dto.delta > 0 ? { referralEarned: { increment: dto.delta } } : {}),
      },
    });
  }

  async overrideTier(userId: string, tierId: string | null): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { referralTierId: tierId } });
  }

  // ── Payouts ──────────────────────────────────────────────────────────────────

  async listPayouts(page: number, limit: number, status?: ReferralPayoutStatus) {
    const where = status ? { status } : {};
    const [payouts, total] = await Promise.all([
      this.prisma.referralPayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.referralPayout.count({ where }),
    ]);

    return {
      data: payouts.map((p) => ({
        ...p,
        amount:      Number(p.amount),
        userName:    `${p.user.firstName ?? ''} ${p.user.lastName ?? ''}`.trim(),
        userEmail:   p.user.email,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markPayoutPaid(payoutId: string, adminId: string): Promise<void> {
    const payout = await this.prisma.referralPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Payout not found' });
    if (payout.status !== ReferralPayoutStatus.REQUESTED) {
      throw new BadRequestException({ code: 'ERR_PAYOUT_STATUS', message: 'Payout is not in REQUESTED status' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.referralPayout.update({
        where: { id: payoutId },
        data: {
          status: ReferralPayoutStatus.PAID,
          processedAt: new Date(),
          processedById: adminId,
          updatedAt: new Date(),
        },
      });

      // Deduct from balance
      await tx.user.update({
        where: { id: payout.userId },
        data: { referralBalance: { decrement: Number(payout.amount) } },
      });

      // Mark CONFIRMED commissions as PAID
      await tx.referralCommission.updateMany({
        where: { earnerId: payout.userId, status: ReferralCommissionStatus.CONFIRMED },
        data: { status: ReferralCommissionStatus.PAID },
      });
    });
  }

  async rejectPayout(payoutId: string, adminId: string, reason: string): Promise<void> {
    const payout = await this.prisma.referralPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Payout not found' });
    if (payout.status !== ReferralPayoutStatus.REQUESTED) {
      throw new BadRequestException({ code: 'ERR_PAYOUT_STATUS', message: 'Payout is not in REQUESTED status' });
    }

    await this.prisma.referralPayout.update({
      where: { id: payoutId },
      data: {
        status: ReferralPayoutStatus.REJECTED,
        adminNotes: reason,
        processedAt: new Date(),
        processedById: adminId,
        updatedAt: new Date(),
      },
    });
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  async getSettings() {
    const s = await this.prisma.referralSettings.findUnique({ where: { id: 'singleton' } });
    if (!s) return null;
    return {
      level1Rate:           Number(s.level1Rate),
      level2Rate:           Number(s.level2Rate),
      level3Rate:           Number(s.level3Rate),
      buyerDiscountRate:    Number(s.buyerDiscountRate),
      buyerDiscountEnabled: s.buyerDiscountEnabled,
      minPayoutAmount:      Number(s.minPayoutAmount),
      lockDays:             s.lockDays,
      isEnabled:            s.isEnabled,
    };
  }

  async updateSettings(dto: AdminReferralSettingsDto) {
    await this.prisma.referralSettings.update({
      where: { id: 'singleton' },
      data: {
        level1Rate:           dto.level1Rate,
        level2Rate:           dto.level2Rate,
        level3Rate:           dto.level3Rate,
        buyerDiscountRate:    dto.buyerDiscountRate,
        buyerDiscountEnabled: dto.buyerDiscountEnabled,
        minPayoutAmount:      dto.minPayoutAmount,
        lockDays:             dto.lockDays,
        isEnabled:            dto.isEnabled,
      },
    });
  }

  // ── Tiers ────────────────────────────────────────────────────────────────────

  async getTiers() {
    return this.prisma.referralTier.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createTier(dto: AdminTierDto) {
    return this.prisma.referralTier.create({
      data: {
        id:             `rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name:           dto.name,
        minReferrals:   dto.minReferrals,
        minEarned:      dto.minEarned,
        commissionBonus: dto.commissionBonus,
        badgeColor:     dto.badgeColor,
        badgeIcon:      dto.badgeIcon,
        sortOrder:      dto.sortOrder,
      },
    });
  }

  async updateTier(id: string, dto: Partial<AdminTierDto>) {
    const tier = await this.prisma.referralTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Tier not found' });
    return this.prisma.referralTier.update({ where: { id }, data: dto });
  }

  async deleteTier(id: string) {
    const usersInTier = await this.prisma.user.count({ where: { referralTierId: id } });
    if (usersInTier > 0) {
      throw new BadRequestException({
        code: 'ERR_TIER_IN_USE',
        message: `Cannot delete tier: ${usersInTier} users are currently in this tier`,
      });
    }
    await this.prisma.referralTier.delete({ where: { id } });
  }
}
