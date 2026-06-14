import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignSeason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateCampaignDto } from './dto/campaign.dto';

// Default values per season used for auto-seeding
const SEASON_DEFAULTS: Record<CampaignSeason, {
  name:         string;
  bannerText:   string;
  ctaLabel:     string;
  ctaHref:      string;
  gradient:     string;
  primaryColor: string;
  accentColor:  string;
  bgColor:      string;
}> = {
  spring: {
    name:         'Spring Collection',
    bannerText:   '🌿 Spring is here — fresh arrivals & limited deals',
    ctaLabel:     'Shop Spring',
    ctaHref:      '/products?season=spring',
    gradient:     'from-[#A8E6CF] to-[#DCEDC1]',
    primaryColor: '#4CAF50',
    accentColor:  '#8BC34A',
    bgColor:      '#F1F8E9',
  },
  summer: {
    name:         'Summer Sale',
    bannerText:   '☀️ Summer Sale — up to 40% off handmade goods',
    ctaLabel:     'Shop Summer',
    ctaHref:      '/products?season=summer',
    gradient:     'from-[#FFD54F] to-[#FF8A65]',
    primaryColor: '#FF6F00',
    accentColor:  '#FFC107',
    bgColor:      '#FFF8E1',
  },
  autumn: {
    name:         'Autumn Harvest',
    bannerText:   '🍂 Cozy autumn finds — warm tones, warm hearts',
    ctaLabel:     'Shop Autumn',
    ctaHref:      '/products?season=autumn',
    gradient:     'from-[#D7CCC8] to-[#FF8A65]',
    primaryColor: '#E64A19',
    accentColor:  '#FF7043',
    bgColor:      '#FBE9E7',
  },
  winter: {
    name:         'Winter Wonderland',
    bannerText:   '❄️ Gift the handmade — winter deals inside',
    ctaLabel:     'Shop Winter',
    ctaHref:      '/products?season=winter',
    gradient:     'from-[#B3E5FC] to-[#E1F5FE]',
    primaryColor: '#0288D1',
    accentColor:  '#29B6F6',
    bgColor:      '#E3F2FD',
  },
};

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  // Ensure all 4 seasonal campaigns exist (idempotent)
  private async ensureSeeded() {
    const seasons = Object.keys(SEASON_DEFAULTS) as CampaignSeason[];
    await Promise.all(
      seasons.map((season) =>
        this.prisma.campaign.upsert({
          where:  { season },
          create: { season, ...SEASON_DEFAULTS[season] },
          update: {},
        }),
      ),
    );
  }

  async findAll(season?: string) {
    await this.ensureSeeded();

    const where = season && season in SEASON_DEFAULTS
      ? { season: season as CampaignSeason }
      : {};

    const campaigns = await this.prisma.campaign.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { season: 'asc' }],
    });

    // Count active flash deals per season window (best-effort)
    const now = new Date();
    const flashDealsCount = await this.prisma.flashDeal.count({
      where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
    });

    return campaigns.map((c) => ({
      id:           c.id,
      name:         c.name,
      season:       c.season,
      isActive:     c.isActive,
      bannerText:   c.bannerText,
      ctaLabel:     c.ctaLabel,
      ctaHref:      c.ctaHref,
      countdownEnd: c.countdownEnd?.toISOString() ?? null,
      gradient:     c.gradient,
      primaryColor: c.primaryColor,
      accentColor:  c.accentColor,
      bgColor:      c.bgColor,
      flashDeals:   c.isActive ? flashDealsCount : 0,
      startDate:    c.startDate?.toISOString() ?? null,
      endDate:      c.endDate?.toISOString()   ?? null,
      updatedAt:    c.updatedAt.toISOString(),
    }));
  }

  async getStats() {
    await this.ensureSeeded();

    const now = new Date();
    const [activeCampaigns, totalFlashDeals] = await Promise.all([
      this.prisma.campaign.count({ where: { isActive: true } }),
      this.prisma.flashDeal.count({
        where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
      }),
    ]);

    return {
      activeCampaigns,
      totalFlashDeals,
      campaignRevenue: 0,  // requires analytics integration
      avgOrderLift:    0,  // requires A/B tracking
    };
  }

  async activate(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.prisma.campaign.update({ where: { id }, data: { isActive: true } });
  }

  async deactivate(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.prisma.campaign.update({ where: { id }, data: { isActive: false } });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    return this.prisma.campaign.update({
      where: { id },
      data: {
        bannerText:   dto.bannerText,
        ctaLabel:     dto.ctaLabel,
        ctaHref:      dto.ctaHref,
        gradient:     dto.gradient,
        primaryColor: dto.primaryColor,
        accentColor:  dto.accentColor,
        bgColor:      dto.bgColor,
        isActive:     dto.isActive,
        countdownEnd: dto.countdownEnd ? new Date(dto.countdownEnd) : undefined,
        startDate:    dto.startDate   ? new Date(dto.startDate)    : undefined,
        endDate:      dto.endDate     ? new Date(dto.endDate)      : undefined,
      },
    });
  }
}
