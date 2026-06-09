import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AffiliateStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { ApplyAffiliateDto } from './dto/apply-affiliate.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  async getPublicSettings() {
    return this.prisma.affiliateSettings.findUnique({
      where:  { id: 'singleton' },
      select: {
        defaultRate:      true,
        buyerDiscountRate: true,
        cookieDays:       true,
        minPayoutAmount:  true,
        lockDays:         true,
        isEnabled:        true,
      },
    });
  }

  async applyAffiliate(dto: ApplyAffiliateDto) {
    const existing = await this.prisma.affiliateAccount.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An application with this email already exists.');
    }

    // Build referral code from request or derive from name
    const raw  = dto.desiredReferralCode?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? '';
    let   code = raw.length >= 4 && raw.length <= 20
      ? raw
      : `${dto.firstName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)}${Math.floor(1000 + Math.random() * 9000)}`;

    const taken = await this.prisma.affiliateAccount.findUnique({ where: { referralCode: code } });
    if (taken) {
      code = `${code.slice(0, 16)}${Math.floor(10 + Math.random() * 90)}`;
    }

    const affiliate = await this.prisma.affiliateAccount.create({
      data: {
        email:            dto.email.toLowerCase(),
        firstName:        dto.firstName,
        lastName:         dto.lastName,
        website:          dto.website,
        promoDescription: dto.promoDescription,
        referralCode:     code,
        status:           AffiliateStatus.PENDING,
      },
      select: { id: true, referralCode: true, status: true },
    });

    // Fire-and-forget: application received confirmation
    const shopUrl = this.config.get<string>('FRONTEND_URL', 'https://mapleloomhandmade.com');
    void this.emailQueue
      .add(JOBS.SEND_EMAIL, {
        to:       dto.email.toLowerCase(),
        subject:  'We received your MapleLoom affiliate application 🎉',
        template: 'application-received',
        data: {
          firstName: dto.firstName,
          shopUrl,
          year: new Date().getFullYear(),
        },
      })
      .catch((err: Error) =>
        this.logger.warn(`Failed to queue application-received email: ${err.message}`),
      );

    return affiliate;
  }

  // ── Authenticated portal ────────────────────────────────────────────────────

  async getMyAffiliate(userId: string) {
    return this.prisma.affiliateAccount.findUnique({
      where:  { userId },
      select: {
        id:          true,
        status:      true,
        referralCode: true,
        balance:     true,
        totalEarned: true,
        firstName:   true,
        lastName:    true,
        email:       true,
      },
    });
  }

  async getDashboard(affiliateId: string) {
    const [affiliate, totalClicks, totalConversions, recentCommissions] = await Promise.all([
      this.prisma.affiliateAccount.findUnique({
        where:  { id: affiliateId },
        select: { balance: true, totalEarned: true, referralCode: true },
      }),
      this.prisma.affiliateClick.count({ where: { affiliateId } }),
      this.prisma.affiliateClick.count({ where: { affiliateId, convertedAt: { not: null } } }),
      this.prisma.affiliateCommission.findMany({
        where:   { affiliateId },
        orderBy: { createdAt: 'desc' },
        take:    10,
        include: { order: { select: { orderNumber: true } } },
      }),
    ]);

    return {
      balance:          Number(affiliate?.balance    ?? 0),
      totalEarned:      Number(affiliate?.totalEarned ?? 0),
      referralCode:     affiliate?.referralCode ?? '',
      totalClicks,
      totalConversions,
      conversionRate:   totalClicks > 0 ? totalConversions / totalClicks : 0,
      recentCommissions: recentCommissions.map((c) => ({
        id:          c.id,
        orderId:     c.orderId,
        orderNumber: c.order.orderNumber,
        amount:      Number(c.amount),
        status:      c.status,
        createdAt:   c.createdAt,
      })),
    };
  }

  async getMyClicks(affiliateId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [clicks, total] = await Promise.all([
      this.prisma.affiliateClick.findMany({
        where:   { affiliateId },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
        select:  { id: true, landingPage: true, convertedAt: true, orderId: true, createdAt: true },
      }),
      this.prisma.affiliateClick.count({ where: { affiliateId } }),
    ]);

    return {
      data:       clicks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMyPayouts(affiliateId: string) {
    return this.prisma.affiliatePayout.findMany({
      where:   { affiliateId },
      orderBy: { createdAt: 'desc' },
      select: {
        id:            true,
        amount:        true,
        status:        true,
        paymentMethod: true,
        paymentDetail: true,
        createdAt:     true,
        processedAt:   true,
      },
    });
  }

  async requestPayout(affiliateId: string, dto: RequestPayoutDto) {
    const [affiliate, settings] = await Promise.all([
      this.prisma.affiliateAccount.findUnique({
        where:  { id: affiliateId },
        select: { balance: true, status: true },
      }),
      this.prisma.affiliateSettings.findUnique({
        where:  { id: 'singleton' },
        select: { minPayoutAmount: true },
      }),
    ]);

    if (!affiliate || affiliate.status !== AffiliateStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active.');
    }

    const balance   = Number(affiliate.balance);
    const minPayout = Number(settings?.minPayoutAmount ?? 50);

    if (balance < minPayout) {
      throw new BadRequestException(`Minimum payout is $${minPayout.toFixed(2)}.`);
    }
    if (dto.amount > balance) {
      throw new BadRequestException('Requested amount exceeds available balance.');
    }

    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.affiliatePayout.create({
        data: {
          affiliateId,
          amount:        dto.amount,
          paymentMethod: dto.paymentMethod,
          paymentDetail: dto.paymentDetail,
          status:        'REQUESTED',
        },
        select: { id: true, amount: true, status: true },
      });
      await tx.affiliateAccount.update({
        where: { id: affiliateId },
        data:  { balance: { decrement: dto.amount } },
      });
      return payout;
    });
  }
}
