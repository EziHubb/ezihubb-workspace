import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OffsiteAdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param offsetDays When 0 (default), the window is the trailing `days`
   * ending now. When >0, the window is shifted back by `offsetDays` — used
   * to fetch the immediately-preceding period of equal length for a
   * "compare to previous period" view (offsetDays = days).
   */
  async getStats(storeId: string, days = 30, offsetDays = 0) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { offsiteAdsOptedOut: true },
    });
    if (!store) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Store not found' });

    const until = offsetDays > 0 ? new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000) : new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
    const createdAtWindow = offsetDays > 0 ? { gte: since, lt: until } : { gte: since };

    const [clicks, feeAgg, byChannel, byListing, myOrders] = await Promise.all([
      this.prisma.storeLinkClick.findMany({
        where: { storeId, kind: 'OFFSITE_AD', createdAt: createdAtWindow },
        select: { source: true, productId: true, convertedAt: true, createdAt: true, orderId: true },
      }),
      this.prisma.sellerLedgerEntry.aggregate({
        where: { storeId, type: 'OFFSITE_ADS_FEE', createdAt: createdAtWindow },
        _sum: { amount: true },
      }),
      this.prisma.storeLinkClick.groupBy({
        by: ['source'],
        where: { storeId, kind: 'OFFSITE_AD', createdAt: createdAtWindow },
        _count: { _all: true },
      }),
      this.prisma.storeLinkClick.groupBy({
        by: ['productId'],
        where: { storeId, kind: 'OFFSITE_AD', createdAt: createdAtWindow, productId: { not: null } },
        _count: { _all: true },
      }),
      // Buyers who purchased from THIS store in the window — cross-referenced
      // below against ad clicks logged on OTHER stores' pages ("indirect"
      // traffic: the ad pointed elsewhere, but the buyer ended up here).
      this.prisma.storeOrder.findMany({
        where: { storeId, createdAt: createdAtWindow, visitorId: { not: null } },
        select: { id: true, orderId: true, subtotal: true, visitorId: true, order: { select: { userId: true } } },
      }),
    ]);

    const conversions = clicks.filter((c) => c.convertedAt).length;

    const myVisitorIds = [...new Set(myOrders.map((o) => o.visitorId as string))];
    const indirectClicksForVisitors = myVisitorIds.length
      ? await this.prisma.storeLinkClick.findMany({
          where: { kind: 'OFFSITE_AD', storeId: { not: storeId }, visitorId: { in: myVisitorIds }, createdAt: createdAtWindow },
          select: { visitorId: true },
        })
      : [];
    const indirectClicks = indirectClicksForVisitors.length;
    const indirectVisitorSet = new Set(indirectClicksForVisitors.map((c) => c.visitorId));

    // ── Direct: this store's own converted clicks, joined to the order they produced ──
    const directOrderIds = clicks.filter((c) => c.orderId).map((c) => c.orderId as string);
    const directStoreOrders = directOrderIds.length
      ? await this.prisma.storeOrder.findMany({
          where: { orderId: { in: directOrderIds }, storeId },
          select: { orderId: true, subtotal: true, order: { select: { userId: true } } },
        })
      : [];
    const directRevenue = directStoreOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const directBuyerIds = [...new Set(directStoreOrders.map((o) => o.order.userId).filter((id): id is string => !!id))];
    const directNewBuyers = await this.countFirstTimeBuyers(storeId, directBuyerIds, since);

    // ── Indirect: this store's orders whose visitor clicked an ad for a DIFFERENT shop ──
    const indirectStoreOrders = myOrders.filter((o) => indirectVisitorSet.has(o.visitorId as string));
    const indirectRevenue = indirectStoreOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const indirectBuyerIds = [...new Set(indirectStoreOrders.map((o) => o.order.userId).filter((id): id is string => !!id))];
    const indirectNewBuyers = await this.countFirstTimeBuyers(storeId, indirectBuyerIds, since);

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
      direct: {
        revenue:   directRevenue,
        orders:    directStoreOrders.length,
        newBuyers: directNewBuyers,
        adFees:    Math.abs(Number(feeAgg._sum.amount ?? 0)),
      },
      indirect: {
        revenue:   indirectRevenue,
        orders:    indirectStoreOrders.length,
        newBuyers: indirectNewBuyers,
        // Indirect traffic is $0 fee by definition — it isn't attributed to
        // this store's own ad, so we never charge for it.
        fees: 0,
      },
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

  /** Of the given buyers, how many had never ordered from this store before `since`. */
  private async countFirstTimeBuyers(storeId: string, buyerIds: string[], since: Date): Promise<number> {
    if (buyerIds.length === 0) return 0;
    const priorBuyers = await this.prisma.storeOrder.findMany({
      where: { storeId, createdAt: { lt: since }, order: { userId: { in: buyerIds } } },
      select: { order: { select: { userId: true } } },
    });
    const priorBuyerSet = new Set(priorBuyers.map((o) => o.order.userId));
    return buyerIds.filter((id) => !priorBuyerSet.has(id)).length;
  }

  async setOptOut(storeId: string, optedOut: boolean) {
    await this.prisma.store.update({ where: { id: storeId }, data: { offsiteAdsOptedOut: optedOut } });
    return { offsiteAdsOptedOut: optedOut };
  }
}
