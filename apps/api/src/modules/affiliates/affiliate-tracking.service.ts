import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ResolvedAffiliate {
  affiliateId:  string;
  discountRate: number;
}

@Injectable()
export class AffiliateTrackingService {
  private readonly logger = new Logger(AffiliateTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logClick(dto: {
    referralCode: string;
    visitorId:    string;
    ip?:          string;
    userAgent?:   string;
    landingPage:  string;
    referrer?:    string;
  }): Promise<void> {
    const affiliate = await this.prisma.affiliateAccount.findFirst({
      where:  { referralCode: dto.referralCode, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!affiliate) return; // silent — don't expose invalid/inactive codes

    // Deduplicate: same visitor + same affiliate within 1 hour = skip
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1_000);
    const recentClick = await this.prisma.affiliateClick.findFirst({
      where: {
        affiliateId: affiliate.id,
        visitorId:   dto.visitorId,
        createdAt:   { gte: oneHourAgo },
      },
    });
    if (recentClick) return;

    await this.prisma.affiliateClick.create({
      data: {
        affiliateId: affiliate.id,
        visitorId:   dto.visitorId,
        ip:          dto.ip,
        userAgent:   dto.userAgent,
        landingPage: dto.landingPage.slice(0, 500),
        referrer:    dto.referrer?.slice(0, 500),
      },
    });

    this.logger.debug(`Click logged: ${dto.referralCode} visitor=${dto.visitorId}`);
  }

  // Resolve referralCode → affiliateId + buyer discount rate (called at checkout)
  async resolveAffiliate(referralCode: string): Promise<ResolvedAffiliate | null> {
    const [affiliate, settings] = await Promise.all([
      this.prisma.affiliateAccount.findFirst({
        where:  { referralCode, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.affiliateSettings.findUnique({
        where:  { id: 'singleton' },
        select: { buyerDiscountRate: true, isEnabled: true },
      }),
    ]);

    if (!affiliate || !settings?.isEnabled) return null;

    return {
      affiliateId:  affiliate.id,
      discountRate: Number(settings.buyerDiscountRate),
    };
  }

  // Resolve referralCode → buyer-facing discount info (first name only — privacy)
  async resolveForBuyer(referralCode: string): Promise<{
    discountRate:  number;
    affiliateName: string | undefined;
  } | null> {
    const [affiliate, settings] = await Promise.all([
      this.prisma.affiliateAccount.findFirst({
        where:  { referralCode: referralCode.toUpperCase(), status: 'ACTIVE' },
        select: { firstName: true },
      }),
      this.prisma.affiliateSettings.findUnique({
        where:  { id: 'singleton' },
        select: { buyerDiscountRate: true, isEnabled: true },
      }),
    ]);

    if (!affiliate || !settings?.isEnabled) return null;

    return {
      discountRate:  Number(settings.buyerDiscountRate),
      affiliateName: affiliate.firstName ?? undefined,
    };
  }

  // Mark unconverted clicks for this visitor+affiliate as converted
  async markClickConverted(
    visitorId:   string,
    affiliateId: string,
    orderId:     string,
  ): Promise<void> {
    await this.prisma.affiliateClick.updateMany({
      where: { visitorId, affiliateId, convertedAt: null },
      data:  { convertedAt: new Date(), orderId },
    });
  }
}
