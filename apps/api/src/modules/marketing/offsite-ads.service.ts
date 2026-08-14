import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OffsiteAdsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(storeId: string, days = 30) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { offsiteAdsOptedOut: true },
    });
    if (!store) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Store not found' });

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [clicks, feeAgg, byChannel, byListing, myOrders] = await Promise.all([
      this.prisma.storeLinkClick.findMany({
        where: { storeId, kind: 'OFFSITE_AD', createdAt: { gte: since } },
        select: { source: true, productId: true, convertedAt: true, createdAt: true },
      }),
      this.prisma.sellerLedgerEntry.aggregate({
        where: { storeId, type: 'OFFSITE_ADS_FEE', createdAt: { gte: since } },
        _sum: { amount: true },
      }),
      this.prisma.storeLinkClick.groupBy({
        by: ['source'],
        where: { storeId, kind: 'OFFSITE_AD', createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.storeLinkClick.groupBy({
        by: ['productId'],
        where: { storeId, kind: 'OFFSITE_AD', createdAt: { gte: since }, productId: { not: null } },
        _count: { _all: true },
      }),
      // Buyers who purchased from THIS store in the window — cross-referenced
      // below against ad clicks logged on OTHER stores' pages ("indirect"
      // traffic: the ad pointed elsewhere, but the buyer ended up here).
      this.prisma.storeOrder.findMany({
        where: { storeId, createdAt: { gte: since }, visitorId: { not: null } },
        select: { visitorId: true },
      }),
    ]);

    const conversions = clicks.filter((c) => c.convertedAt).length;

    const myVisitorIds = [...new Set(myOrders.map((o) => o.visitorId as string))];
    const indirectClicks = myVisitorIds.length
      ? await this.prisma.storeLinkClick.count({
          where: { kind: 'OFFSITE_AD', storeId: { not: storeId }, visitorId: { in: myVisitorIds }, createdAt: { gte: since } },
        })
      : 0;

    const dailyMap = new Map<string, number>();
    for (const c of clicks) {
      const day = c.createdAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
    const dailyTraffic = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

    const productIds = byListing.map((l) => l.productId).filter((id): id is string => !!id);
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : [];
    const productNames = new Map(products.map((p) => [p.id, p.name]));

    return {
      offsiteAdsOptedOut: store.offsiteAdsOptedOut,
      totalFee:           Math.abs(Number(feeAgg._sum.amount ?? 0)),
      directClicks:       clicks.length,
      indirectClicks,
      conversions,
      dailyTraffic,
      byChannel: byChannel
        .map((c) => ({ channel: c.source ?? 'Unknown', clicks: c._count._all }))
        .sort((a, b) => b.clicks - a.clicks),
      byListing: byListing
        .map((l) => ({
          productId: l.productId as string,
          productName: productNames.get(l.productId as string) ?? 'Unknown listing',
          clicks: l._count._all,
        }))
        .sort((a, b) => b.clicks - a.clicks),
    };
  }

  async setOptOut(storeId: string, optedOut: boolean) {
    await this.prisma.store.update({ where: { id: storeId }, data: { offsiteAdsOptedOut: optedOut } });
    return { offsiteAdsOptedOut: optedOut };
  }
}
