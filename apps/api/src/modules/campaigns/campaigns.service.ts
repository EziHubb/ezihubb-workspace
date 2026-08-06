import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignSeason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

const SEASON_DEFAULTS: Record<CampaignSeason, {
  name: string; bannerText: string; ctaLabel: string; ctaHref: string;
  gradient: string; primaryColor: string; accentColor: string; bgColor: string;
}> = {
  spring: {
    name: 'Spring Collection', bannerText: '🌿 Spring is here — fresh arrivals & limited deals',
    ctaLabel: 'Shop Spring', ctaHref: '/products?season=spring',
    gradient: 'from-[#A8E6CF] to-[#DCEDC1]', primaryColor: '#4CAF50', accentColor: '#8BC34A', bgColor: '#F1F8E9',
  },
  summer: {
    name: 'Summer Sale', bannerText: '☀️ Summer Sale — up to 40% off handmade goods',
    ctaLabel: 'Shop Summer', ctaHref: '/products?season=summer',
    gradient: 'from-[#FFD54F] to-[#FF8A65]', primaryColor: '#FF6F00', accentColor: '#FFC107', bgColor: '#FFF8E1',
  },
  autumn: {
    name: 'Autumn Harvest', bannerText: '🍂 Cozy autumn finds — warm tones, warm hearts',
    ctaLabel: 'Shop Autumn', ctaHref: '/products?season=autumn',
    gradient: 'from-[#D7CCC8] to-[#FF8A65]', primaryColor: '#E64A19', accentColor: '#FF7043', bgColor: '#FBE9E7',
  },
  winter: {
    name: 'Winter Wonderland', bannerText: '❄️ Gift the handmade — winter deals inside',
    ctaLabel: 'Shop Winter', ctaHref: '/products?season=winter',
    gradient: 'from-[#B3E5FC] to-[#E1F5FE]', primaryColor: '#0288D1', accentColor: '#29B6F6', bgColor: '#E3F2FD',
  },
};

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSeeded() {
    for (const season of Object.values(CampaignSeason)) {
      const exists = await this.prisma.campaign.findFirst({ where: { season } });
      if (!exists) await this.prisma.campaign.create({ data: { season, ...SEASON_DEFAULTS[season] } });
    }
  }

  private mapRow(c: any) {
    return {
      id: c.id, name: c.name, season: c.season ?? null, isActive: c.isActive,
      bannerText: c.bannerText, ctaLabel: c.ctaLabel, ctaHref: c.ctaHref,
      countdownEnd: c.countdownEnd?.toISOString() ?? null,
      gradient: c.gradient, primaryColor: c.primaryColor, accentColor: c.accentColor, bgColor: c.bgColor,
      startDate: c.startDate?.toISOString() ?? null,
      endDate:   c.endDate?.toISOString()   ?? null,
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async findAll(season?: string) {
    await this.ensureSeeded();
    const where = season && Object.values(CampaignSeason).includes(season as CampaignSeason)
      ? { season: season as CampaignSeason } : {};
    const campaigns = await this.prisma.campaign.findMany({ where, orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] });
    return campaigns.map((c) => this.mapRow(c));
  }

  async getActive() {
    const c = await this.prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    return c ? this.mapRow(c) : null;
  }

  async getStats() {
    await this.ensureSeeded();
    const [activeCampaigns, totalCampaigns] = await Promise.all([
      this.prisma.campaign.count({ where: { isActive: true } }),
      this.prisma.campaign.count(),
    ]);
    return { activeCampaigns, totalCampaigns, campaignRevenue: 0, avgOrderLift: 0 };
  }

  async create(dto: CreateCampaignDto) {
    return this.mapRow(await this.prisma.campaign.create({
      data: {
        name: dto.name, season: dto.season as never,
        bannerText:   dto.bannerText   ?? '',
        ctaLabel:     dto.ctaLabel     ?? 'Shop now',
        ctaHref:      dto.ctaHref      ?? '/products',
        gradient:     dto.gradient     ?? '',
        primaryColor: dto.primaryColor ?? '#E85D3F',
        accentColor:  dto.accentColor  ?? '#C44A2E',
        bgColor:      dto.bgColor      ?? '#fff5f3',
        startDate:    dto.startDate    ? new Date(dto.startDate)    : null,
        endDate:      dto.endDate      ? new Date(dto.endDate)      : null,
        countdownEnd: dto.countdownEnd ? new Date(dto.countdownEnd) : null,
      },
    }));
  }

  async update(id: string, dto: UpdateCampaignDto) {
    if (!(await this.prisma.campaign.findUnique({ where: { id } }))) throw new NotFoundException('Campaign not found');
    return this.mapRow(await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name         !== undefined && { name:         dto.name         }),
        ...(dto.season       !== undefined && { season:       dto.season       }),
        ...(dto.bannerText   !== undefined && { bannerText:   dto.bannerText   }),
        ...(dto.ctaLabel     !== undefined && { ctaLabel:     dto.ctaLabel     }),
        ...(dto.ctaHref      !== undefined && { ctaHref:      dto.ctaHref      }),
        ...(dto.gradient     !== undefined && { gradient:     dto.gradient     }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.accentColor  !== undefined && { accentColor:  dto.accentColor  }),
        ...(dto.bgColor      !== undefined && { bgColor:      dto.bgColor      }),
        ...(dto.isActive     !== undefined && { isActive:     dto.isActive     }),
        ...(dto.countdownEnd !== undefined && { countdownEnd: dto.countdownEnd ? new Date(dto.countdownEnd) : null }),
        ...(dto.startDate    !== undefined && { startDate:    dto.startDate    ? new Date(dto.startDate)    : null }),
        ...(dto.endDate      !== undefined && { endDate:      dto.endDate      ? new Date(dto.endDate)      : null }),
      },
    }));
  }

  async delete(id: string) {
    if (!(await this.prisma.campaign.findUnique({ where: { id } }))) throw new NotFoundException('Campaign not found');
    await this.prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  }

  async activate(id: string) {
    if (!(await this.prisma.campaign.findUnique({ where: { id } }))) throw new NotFoundException('Campaign not found');
    return this.mapRow(await this.prisma.campaign.update({ where: { id }, data: { isActive: true } }));
  }

  async deactivate(id: string) {
    if (!(await this.prisma.campaign.findUnique({ where: { id } }))) throw new NotFoundException('Campaign not found');
    return this.mapRow(await this.prisma.campaign.update({ where: { id }, data: { isActive: false } }));
  }
}
