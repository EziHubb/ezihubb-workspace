import { Injectable, Logger } from '@nestjs/common';
import { FlashDealStatus, OrderStatus, VipTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// BuyerVipStatus uses NONE/SILVER/GOLD tiers
const GMV_THRESHOLDS: Record<VipTier, number> = {
  [VipTier.NONE]:   0,
  [VipTier.SILVER]: 200,
  [VipTier.GOLD]:   500,
};

function computeTier(gmv: number): VipTier {
  if (gmv >= GMV_THRESHOLDS[VipTier.GOLD])   return VipTier.GOLD;
  if (gmv >= GMV_THRESHOLDS[VipTier.SILVER]) return VipTier.SILVER;
  return VipTier.NONE;
}

@Injectable()
export class VipService {
  private readonly logger = new Logger(VipService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getVipStatus(userId: string) {
    return this.prisma.buyerVipStatus.findUnique({ where: { userId } });
  }

  async recomputeAllTiers(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const recentOrders = await this.prisma.order.findMany({
      where: { status: OrderStatus.DELIVERED, createdAt: { gte: cutoff } },
      select: { userId: true, total: true },
    });

    if (recentOrders.length === 0) return;

    const spendMap = new Map<string, number>();
    for (const order of recentOrders) {
      if (!order.userId) continue;
      spendMap.set(order.userId, (spendMap.get(order.userId) ?? 0) + Number(order.total));
    }

    const now = new Date();
    for (const [userId, gmv] of spendMap.entries()) {
      const tier = computeTier(gmv);
      await this.prisma.buyerVipStatus.upsert({
        where:  { userId },
        create: { userId, tier, currentGmv90d: gmv, lastCheckedAt: now },
        update: { tier, currentGmv90d: gmv, lastCheckedAt: now },
      });
    }

    this.logger.log(`VIP recompute: ${spendMap.size} users updated`);
  }

  async checkFlashDealAccess(userId: string): Promise<boolean> {
    const vipStatus = await this.prisma.buyerVipStatus.findUnique({ where: { userId } });
    if (!vipStatus) return false;
    return vipStatus.tier !== VipTier.NONE;
  }

  async getEarlyAccessDeals(userId: string) {
    const vipStatus = await this.prisma.buyerVipStatus.findUnique({ where: { userId } });
    if (!vipStatus || vipStatus.tier === VipTier.NONE) return [];

    return this.prisma.flashDeal.findMany({
      where: { status: FlashDealStatus.APPROVED },
      orderBy: { startsAt: 'asc' },
      include: { product: { select: { id: true, name: true, slug: true, basePrice: true, images: { take: 1 } } } },
    });
  }
}
