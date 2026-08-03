import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AffiliateStatus, CommissionStatus, PayoutStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import {
  ApproveAffiliateDto,
  RejectAffiliateDto,
  UpdateAffiliateDto,
  UpdateAffiliateSettingsDto,
  AdminPayoutActionDto,
  RejectPayoutDto,
} from './dto/admin-affiliate.dto';

@Injectable()
export class AdminAffiliatesService {
  private readonly logger = new Logger(AdminAffiliatesService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── List + count ────────────────────────────────────────────────────────────

  async listAffiliates({
    status,
    page  = 1,
    limit = 20,
    search,
  }: {
    status?: string;
    page?:   number;
    limit?:  number;
    search?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status as AffiliateStatus;
    if (search) {
      where['OR'] = [
        { email:        { contains: search, mode: 'insensitive' } },
        { firstName:    { contains: search, mode: 'insensitive' } },
        { lastName:     { contains: search, mode: 'insensitive' } },
        { referralCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.affiliateAccount.findMany({
        where:   where as Prisma.AffiliateAccountWhereInput,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        select: {
          id:             true,
          email:          true,
          firstName:      true,
          lastName:       true,
          website:        true,
          referralCode:   true,
          status:         true,
          commissionRate: true,
          balance:        true,
          createdAt:      true,
        },
      }),
      this.prisma.affiliateAccount.count({ where: where as Prisma.AffiliateAccountWhereInput }),
    ]);

    return {
      data:       data.map((a) => ({ ...a, balance: Number(a.balance), commissionRate: a.commissionRate !== null ? Number(a.commissionRate) : null })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPendingCount(): Promise<number> {
    return this.prisma.affiliateAccount.count({ where: { status: AffiliateStatus.PENDING } });
  }

  // ── Detail ──────────────────────────────────────────────────────────────────

  async getAffiliate(id: string) {
    const affiliate = await this.prisma.affiliateAccount.findUnique({
      where:  { id },
      select: {
        id:              true,
        email:           true,
        firstName:       true,
        lastName:        true,
        website:         true,
        promoDescription: true,
        referralCode:    true,
        commissionRate:  true,
        status:          true,
        balance:         true,
        totalEarned:     true,
        adminNotes:      true,
        rejectedReason:  true,
        approvedAt:      true,
        createdAt:       true,
      },
    });
    if (!affiliate) throw new NotFoundException('Affiliate not found.');

    const [totalClicks, totalConversions, commissions, recentClicks] = await Promise.all([
      this.prisma.affiliateClick.count({ where: { affiliateId: id } }),
      this.prisma.affiliateClick.count({ where: { affiliateId: id, convertedAt: { not: null } } }),
      this.prisma.affiliateCommission.findMany({
        where:   { affiliateId: id },
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true } } },
      }),
      this.prisma.affiliateClick.findMany({
        where:   { affiliateId: id },
        orderBy: { createdAt: 'desc' },
        take:    20,
        select:  { id: true, landingPage: true, convertedAt: true, createdAt: true },
      }),
    ]);

    return {
      ...affiliate,
      balance:        Number(affiliate.balance),
      totalEarned:    Number(affiliate.totalEarned),
      commissionRate: affiliate.commissionRate !== null ? Number(affiliate.commissionRate) : null,
      stats: {
        totalClicks,
        totalConversions,
        conversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
      },
      commissions: commissions.map((c) => ({
        id:          c.id,
        orderId:     c.orderId,
        orderNumber: c.order.orderNumber,
        baseAmount:  Number(c.baseAmount),
        rate:        Number(c.rate),
        amount:      Number(c.amount),
        status:      c.status,
        confirmedAt: c.confirmedAt,
        cancelledAt: c.cancelledAt,
        createdAt:   c.createdAt,
      })),
      recentClicks,
    };
  }

  // ── Approve / Reject / Update ───────────────────────────────────────────────

  async approveAffiliate(id: string, dto: ApproveAffiliateDto, adminId: string) {
    const [existing, settings] = await Promise.all([
      this.prisma.affiliateAccount.findUnique({
        where:  { id },
        select: { status: true, email: true, firstName: true, referralCode: true },
      }),
      this.prisma.affiliateSettings.findUnique({
        where:  { id: 'singleton' },
        select: { defaultRate: true, buyerDiscountRate: true },
      }),
    ]);

    if (!existing) throw new NotFoundException('Affiliate not found.');
    if (existing.status === AffiliateStatus.ACTIVE) {
      throw new BadRequestException('Affiliate is already active.');
    }

    const updated = await this.prisma.affiliateAccount.update({
      where: { id },
      data:  {
        status:         AffiliateStatus.ACTIVE,
        commissionRate: dto.commissionRate ?? null,
        approvedAt:     new Date(),
        approvedById:   adminId,
      },
      select: { id: true, status: true, referralCode: true },
    });

    // Fire-and-forget: affiliate approved email
    const shopUrl         = this.config.get<string>('FRONTEND_URL', 'https://ezihubb.com');
    const effectiveRate   = dto.commissionRate ?? Number(settings?.defaultRate ?? 0.10);
    const buyerDiscount   = Number(settings?.buyerDiscountRate ?? 0.05);

    void this.emailQueue
      .add(JOBS.SEND_EMAIL, {
        to:       existing.email,
        subject:  "You're in! Your EziHubb affiliate account is ready ✅",
        template: 'affiliate-approved',
        data: {
          firstName:        existing.firstName ?? 'there',
          referralCode:     existing.referralCode,
          referralUrl:      `${shopUrl}?ref=${existing.referralCode}`,
          commissionRate:   Math.round(effectiveRate * 100),
          buyerDiscountRate: Math.round(buyerDiscount * 100),
          shopUrl,
          year:             new Date().getFullYear(),
        },
      })
      .catch((err: Error) =>
        this.logger.warn(`Failed to queue affiliate-approved email for ${id}: ${err.message}`),
      );

    return updated;
  }

  async rejectAffiliate(id: string, dto: RejectAffiliateDto) {
    const affiliate = await this.prisma.affiliateAccount.findUnique({
      where:  { id },
      select: { email: true, firstName: true },
    });
    if (!affiliate) throw new NotFoundException('Affiliate not found.');

    const updated = await this.prisma.affiliateAccount.update({
      where:  { id },
      data:   { status: AffiliateStatus.REJECTED, rejectedReason: dto.reason },
      select: { id: true, status: true },
    });

    // Fire-and-forget: affiliate rejected email
    const shopUrl = this.config.get<string>('FRONTEND_URL', 'https://ezihubb.com');

    void this.emailQueue
      .add(JOBS.SEND_EMAIL, {
        to:       affiliate.email,
        subject:  'Update on your EziHubb affiliate application',
        template: 'affiliate-rejected',
        data: {
          firstName:      affiliate.firstName ?? 'there',
          rejectedReason: dto.reason,
          shopUrl,
          year:           new Date().getFullYear(),
        },
      })
      .catch((err: Error) =>
        this.logger.warn(`Failed to queue affiliate-rejected email for ${id}: ${err.message}`),
      );

    return updated;
  }

  async updateAffiliate(id: string, dto: UpdateAffiliateDto) {
    const data: Record<string, unknown> = {};
    if (dto.status     !== undefined) data['status']         = dto.status as AffiliateStatus;
    if (dto.adminNotes !== undefined) data['adminNotes']     = dto.adminNotes;
    if ('commissionRate' in dto)       data['commissionRate'] = dto.commissionRate ?? null;

    return this.prisma.affiliateAccount.update({
      where:  { id },
      data:   data as Prisma.AffiliateAccountUpdateInput,
      select: { id: true, status: true, commissionRate: true, adminNotes: true },
    });
  }

  // ── Payouts ─────────────────────────────────────────────────────────────────

  async listPayouts({
    status,
    page  = 1,
    limit = 20,
  }: {
    status?: string;
    page?:   number;
    limit?:  number;
  }) {
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status as PayoutStatus;

    const [data, total] = await Promise.all([
      this.prisma.affiliatePayout.findMany({
        where:   where as Prisma.AffiliatePayoutWhereInput,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          affiliate: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.affiliatePayout.count({ where: where as Prisma.AffiliatePayoutWhereInput }),
    ]);

    return {
      data:       data.map((p) => ({ ...p, amount: Number(p.amount) })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markPayoutPaid(id: string, dto: AdminPayoutActionDto, adminId: string) {
    const payout = await this.prisma.affiliatePayout.findUnique({
      where:   { id },
      include: {
        affiliate: { select: { email: true, firstName: true, balance: true } },
      },
    });
    if (!payout) throw new NotFoundException('Payout not found.');
    if (payout.status === PayoutStatus.PAID) {
      throw new BadRequestException('Payout has already been marked as paid.');
    }

    await this.prisma.$transaction([
      this.prisma.affiliatePayout.update({
        where: { id },
        data:  {
          status:        PayoutStatus.PAID,
          processedAt:   new Date(),
          processedById: adminId,
          adminNotes:    dto.adminNotes ?? null,
        },
      }),
      this.prisma.affiliateCommission.updateMany({
        where: { affiliateId: payout.affiliateId, status: CommissionStatus.CONFIRMED },
        data:  { status: CommissionStatus.PAID },
      }),
    ]);

    // Fire-and-forget: payout processed email
    const shopUrl          = this.config.get<string>('FRONTEND_URL', 'https://ezihubb.com');
    const amount           = Number(payout.amount);
    // Balance was already decremented when affiliate requested; this is the current remaining balance
    const remainingBalance = Number(payout.affiliate.balance);
    const methodLabel      = payout.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    void this.emailQueue
      .add(JOBS.SEND_EMAIL, {
        to:       payout.affiliate.email,
        subject:  `Your $${amount.toFixed(2)} payout is on its way 🚀`,
        template: 'payout-processed',
        data: {
          firstName:        payout.affiliate.firstName ?? 'there',
          amount:           amount.toFixed(2),
          paymentMethod:    methodLabel,
          remainingBalance: remainingBalance.toFixed(2),
          payoutsUrl:       `${shopUrl}/affiliate/payouts`,
          shopUrl,
          year:             new Date().getFullYear(),
        },
      })
      .catch((err: Error) =>
        this.logger.warn(`Failed to queue payout-processed email for payout ${id}: ${err.message}`),
      );

    return { id, status: PayoutStatus.PAID };
  }

  async rejectPayout(id: string, dto: RejectPayoutDto, adminId: string) {
    const payout = await this.prisma.affiliatePayout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found.');
    if (payout.status === PayoutStatus.PAID || payout.status === PayoutStatus.REJECTED) {
      throw new BadRequestException('Payout cannot be rejected in its current state.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.affiliatePayout.update({
        where: { id },
        data:  {
          status:        PayoutStatus.REJECTED,
          processedById: adminId,
          adminNotes:    dto.reason,
        },
        select: { id: true, status: true },
      });
      await tx.affiliateAccount.update({
        where: { id: payout.affiliateId },
        data:  { balance: { increment: payout.amount } },
      });
      return updated;
    });
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  async getSettings() {
    return this.prisma.affiliateSettings.findUnique({ where: { id: 'singleton' } });
  }

  async updateSettings(dto: UpdateAffiliateSettingsDto) {
    const data: Record<string, unknown> = {};
    if (dto.isEnabled          !== undefined) data['isEnabled']          = dto.isEnabled;
    if (dto.defaultRate        !== undefined) data['defaultRate']        = dto.defaultRate;
    if (dto.buyerDiscountRate  !== undefined) data['buyerDiscountRate']  = dto.buyerDiscountRate;
    if (dto.cookieDays         !== undefined) data['cookieDays']         = dto.cookieDays;
    if (dto.minPayoutAmount    !== undefined) data['minPayoutAmount']    = dto.minPayoutAmount;
    if (dto.lockDays           !== undefined) data['lockDays']           = dto.lockDays;

    return this.prisma.affiliateSettings.upsert({
      where:  { id: 'singleton' },
      update: data as Prisma.AffiliateSettingsUpdateInput,
      create: { id: 'singleton', ...data } as Prisma.AffiliateSettingsCreateInput,
    });
  }
}
