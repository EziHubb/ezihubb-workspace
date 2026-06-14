import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FlashDealStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { JOBS, QUEUES } from '../../queue/queue.constants';

const ACTIVE_DEALS_CACHE_KEY = 'flash-deals:active';
const CACHE_TTL = 60; // 60 seconds

@Injectable()
export class FlashDealService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUES.FLASH_DEALS) private readonly flashDealsQueue: Queue,
  ) {}

  async getActiveDeals() {
    const cached = await this.redis.get<any[]>(ACTIVE_DEALS_CACHE_KEY);
    if (cached) return cached;

    const now = new Date();
    const deals = await this.prisma.flashDeal.findMany({
      where: {
        status: FlashDealStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true, basePrice: true, images: { take: 1 } },
        },
      },
      orderBy: { endsAt: 'asc' },
    });

    await this.redis.set(ACTIVE_DEALS_CACHE_KEY, deals, CACHE_TTL);
    return deals;
  }

  async getDeal(dealId: string) {
    const deal = await this.prisma.flashDeal.findUnique({
      where: { id: dealId },
      include: {
        product: {
          select: { id: true, name: true, slug: true, basePrice: true, images: { take: 1 } },
        },
      },
    });
    if (!deal) throw new NotFoundException('Flash deal not found');
    return deal;
  }

  async purchase(dealId: string, orderId: string): Promise<void> {
    const deal = await this.prisma.flashDeal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Flash deal not found');
    if (deal.status !== FlashDealStatus.ACTIVE) {
      throw new BadRequestException('Flash deal is not active');
    }
    if (deal.quantityLimit !== null && deal.soldCount >= deal.quantityLimit) {
      throw new BadRequestException('Flash deal sold out');
    }

    await this.prisma.$transaction([
      this.prisma.flashDeal.update({
        where: { id: dealId },
        data: { soldCount: { increment: 1 } },
      }),
      this.prisma.flashDealOrder.create({
        data: { flashDealId: dealId, orderId },
      }),
    ]);

    await this.redis.del(ACTIVE_DEALS_CACHE_KEY);
  }

  async scheduleDeals(): Promise<void> {
    const now = new Date();

    // Activate deals that are approved and whose window has started
    const toActivate = await this.prisma.flashDeal.findMany({
      where: { status: FlashDealStatus.APPROVED, startsAt: { lte: now }, endsAt: { gt: now } },
    });
    for (const deal of toActivate) {
      await this.prisma.flashDeal.update({
        where: { id: deal.id },
        data: { status: FlashDealStatus.ACTIVE },
      });
    }

    // End deals whose window has closed
    const toEnd = await this.prisma.flashDeal.findMany({
      where: { status: FlashDealStatus.ACTIVE, endsAt: { lte: now } },
    });
    for (const deal of toEnd) {
      await this.prisma.flashDeal.update({
        where: { id: deal.id },
        data: { status: FlashDealStatus.ENDED },
      });
    }

    if (toActivate.length > 0 || toEnd.length > 0) {
      await this.redis.del(ACTIVE_DEALS_CACHE_KEY);
    }
  }

  async createDeal(dto: {
    storeId: string;
    productId: string;
    originalPrice: number;
    dealPrice: number;
    discountPct: number;
    quantityLimit?: number;
    startsAt: Date;
    endsAt: Date;
    isFeatured?: boolean;
  }) {
    return this.prisma.flashDeal.create({
      data: {
        storeId: dto.storeId,
        productId: dto.productId,
        originalPrice: dto.originalPrice,
        dealPrice: dto.dealPrice,
        discountPct: dto.discountPct,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        soldCount: 0,
        status: FlashDealStatus.PENDING,
        ...(dto.quantityLimit !== undefined && { quantityLimit: dto.quantityLimit }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      },
    });
  }

  async approveDeal(dealId: string): Promise<void> {
    const deal = await this.prisma.flashDeal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Flash deal not found');
    await this.prisma.flashDeal.update({
      where: { id: dealId },
      data: { status: FlashDealStatus.APPROVED },
    });
  }

  async toggleDeal(dealId: string): Promise<void> {
    const deal = await this.prisma.flashDeal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Flash deal not found');
    const newStatus =
      deal.status === FlashDealStatus.ACTIVE ? FlashDealStatus.ENDED : FlashDealStatus.ACTIVE;
    await this.prisma.flashDeal.update({
      where: { id: dealId },
      data: { status: newStatus },
    });
    await this.redis.del(ACTIVE_DEALS_CACHE_KEY);
  }

  async cancelDeal(dealId: string): Promise<void> {
    const deal = await this.prisma.flashDeal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Flash deal not found');
    await this.prisma.flashDeal.update({
      where: { id: dealId },
      data: { status: FlashDealStatus.CANCELLED },
    });
    await this.redis.del(ACTIVE_DEALS_CACHE_KEY);
  }

  async findAdmin(params: { status?: string; page: number; limit: number; storeId?: string }) {
    const { status, page, limit, storeId } = params;
    const statusMap: Partial<Record<string, FlashDealStatus>> = {
      PENDING:  FlashDealStatus.PENDING,
      ACTIVE:   FlashDealStatus.ACTIVE,
      UPCOMING: FlashDealStatus.APPROVED,
      ENDED:    FlashDealStatus.ENDED,
    };
    const where: { status?: FlashDealStatus; storeId?: string } = {};
    if (status && statusMap[status]) where.status = statusMap[status];
    if (storeId) where.storeId = storeId;

    const [rows, total] = await Promise.all([
      this.prisma.flashDeal.findMany({
        where,
        include: {
          store:   { select: { id: true, name: true } },
          product: { select: { id: true, name: true, images: { take: 1, select: { url: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.flashDeal.count({ where }),
    ]);

    return {
      data: rows.map((d) => ({
        id:            d.id,
        storeId:       d.storeId,
        storeName:     d.store.name,
        productId:     d.productId,
        productName:   d.product.name,
        productImage:  d.product.images[0]?.url ?? null,
        originalPrice: Number(d.originalPrice),
        dealPrice:     Number(d.dealPrice),
        discountPct:   Number(d.discountPct),
        startsAt:      d.startsAt.toISOString(),
        endsAt:        d.endsAt.toISOString(),
        quantityLimit: d.quantityLimit,
        soldCount:     d.soldCount,
        submittedAt:   d.createdAt.toISOString(),
        status:        d.status as string,
        isFeatured:    d.isFeatured,
      })),
      total,
    };
  }

  async getAdminStats() {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [activeNow, pendingReview, endingToday, totalThisWeek] = await Promise.all([
      this.prisma.flashDeal.count({ where: { status: FlashDealStatus.ACTIVE } }),
      this.prisma.flashDeal.count({ where: { status: FlashDealStatus.PENDING } }),
      this.prisma.flashDeal.count({ where: { status: FlashDealStatus.ACTIVE, endsAt: { lte: todayEnd } } }),
      this.prisma.flashDeal.count({ where: { createdAt: { gte: weekStart } } }),
    ]);

    return { activeNow, pendingReview, endingToday, totalThisWeek };
  }

  async reviewDeal(dealId: string, payload: {
    approved: boolean;
    commissionOverride: number | null;
    featured: boolean;
    adminNote: string;
    rejectionReason?: string;
  }) {
    const deal = await this.prisma.flashDeal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Flash deal not found');
    await this.prisma.flashDeal.update({
      where: { id: dealId },
      data: {
        status: payload.approved ? FlashDealStatus.APPROVED : FlashDealStatus.CANCELLED,
        ...(payload.featured !== undefined && { isFeatured: payload.featured }),
      },
    });
    if (!payload.approved) {
      await this.redis.del(ACTIVE_DEALS_CACHE_KEY);
    }
  }
}
