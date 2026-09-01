import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

@Injectable()
export class ShopStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  // UTC-explicit — must match AnalyticsService.dateStr(), which writes every
  // Redis counter this service reads (analytics:*). Using local server time
  // here would silently mismatch on any host not running in UTC.
  private dateStr(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private subDays(d: Date, days: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() - days);
    return r;
  }

  private rangeStart(range: string): Date {
    const now = new Date();
    switch (range) {
      case '1d':  return this.subDays(now, 1);
      case '7d':  return this.subDays(now, 7);
      case '30d': return this.subDays(now, 30);
      case '90d': return this.subDays(now, 90);
      default:    return this.subDays(now, 7);
    }
  }

  // ── Shop overview ──────────────────────────────────────────────────────────

  async getOverview(range: string, storeId?: string | null) {
    const start = this.rangeStart(range);
    const days  = Math.round((Date.now() - start.getTime()) / 86_400_000) || 1;

    const orderWhere: Prisma.OrderWhereInput = {
      createdAt: { gte: start },
      status:    { notIn: ['CANCELLED', 'REFUNDED'] },
    };
    if (storeId) orderWhere.storeOrders = { some: { storeId } };
    const paidOrderWhere: Prisma.OrderWhereInput = {
      ...orderWhere,
      payment: { is: { status: 'PAID' } },
    };

    const [totalOrders, orderSum, visits, series] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.aggregate({ where: paidOrderWhere, _sum: { total: true } }),
      this.sumRangeMetric(days, 'visits', storeId),
      storeId
        ? this.getStoreOrderTimeSeries(storeId, start, days)
        : this.getDailyTimeSeries(days),
    ]);

    const totalRevenue = Number(orderSum._sum?.total ?? 0);
    const conversion   = visits > 0 ? ((totalOrders / visits) * 100) : 0;

    return {
      visits,
      orders:         totalOrders,
      revenue:        totalRevenue,
      conversionRate: Math.round(conversion * 10) / 10,
      series,
    };
  }

  /** Sums a Redis daily counter (`analytics:visits:{date}` or the per-store variant) over the last `days` days. */
  private async sumRangeMetric(days: number, metric: string, storeId?: string | null): Promise<number> {
    if (!this.redis.isAvailable()) return 0;
    const dates = Array.from({ length: days }, (_, i) => this.dateStr(this.subDays(new Date(), days - 1 - i)));
    const keys  = dates.map((d) => storeId ? `analytics:store:${storeId}:${d}:${metric}` : `analytics:${metric}:${d}`);
    try {
      const values = await this.redis.getClient().mget(...keys);
      return values.reduce((sum, v) => sum + Number(v ?? 0), 0);
    } catch {
      return 0;
    }
  }

  /** DB-computed daily time series for a specific store (no Redis dependency). */
  private async getStoreOrderTimeSeries(storeId: string, start: Date, days: number) {
    const orders = await this.prisma.order.findMany({
      where: { storeOrders: { some: { storeId } }, createdAt: { gte: start }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      select: { createdAt: true, total: true, payment: { select: { status: true } } },
    });

    const map = new Map<string, { visits: number; orders: number; revenue: number }>();
    for (let i = days - 1; i >= 0; i--) {
      map.set(this.dateStr(this.subDays(new Date(), i)), { visits: 0, orders: 0, revenue: 0 });
    }
    for (const o of orders) {
      const d = this.dateStr(new Date(o.createdAt));
      if (map.has(d)) {
        const row = map.get(d)!;
        row.orders  += 1;
        if (o.payment?.status === 'PAID') row.revenue += Number(o.total);
      }
    }

    if (this.redis.isAvailable()) {
      const dates = [...map.keys()];
      try {
        const values = await this.redis.getClient().mget(
          ...dates.map((d) => `analytics:store:${storeId}:${d}:visits`),
        );
        dates.forEach((d, i) => { map.get(d)!.visits = Number(values[i] ?? 0); });
      } catch { /* no-op */ }
    }

    return [...map.entries()].map(([date, v]) => ({ date, ...v }));
  }

  private async getDailyTimeSeries(days: number) {
    const result: { date: string; visits: number; orders: number; revenue: number }[] = [];
    const client = this.redis.isAvailable() ? this.redis.getClient() : null;

    for (let i = days - 1; i >= 0; i--) {
      const date    = this.dateStr(this.subDays(new Date(), i));
      let revenue   = 0;
      let orders    = 0;
      let visits    = 0;

      if (client) {
        try {
          const [rev, ord, vis] = await Promise.all([
            client.get(`analytics:revenue:${date}`),
            client.get(`analytics:orders:${date}`),
            client.get(`analytics:visits:${date}`),
          ]);
          revenue = Number(rev ?? 0);
          orders  = Number(ord ?? 0);
          visits  = Number(vis ?? 0);
        } catch { /* no-op */ }
      }
      result.push({ date, visits, orders, revenue });
    }
    return result;
  }

  // ── Shopper stats ──────────────────────────────────────────────────────────

  /** % change of current vs. prior equal-length period. previous=0 with current>0 reads as +100%. */
  private pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  async getShopperStats(range: string, storeId?: string | null) {
    const start     = this.rangeStart(range);
    const rangeMs   = Date.now() - start.getTime();
    const prevStart = new Date(start.getTime() - rangeMs);

    const wishWhere: Prisma.WishlistItemWhereInput     = { createdAt: { gte: start } };
    const wishPrevWhere: Prisma.WishlistItemWhereInput  = { createdAt: { gte: prevStart, lt: start } };
    const reviewWhere: Prisma.ReviewWhereInput          = { createdAt: { gte: start } };
    const reviewPrevWhere: Prisma.ReviewWhereInput      = { createdAt: { gte: prevStart, lt: start } };
    if (storeId) {
      wishWhere.product     = { storeId };
      wishPrevWhere.product = { storeId };
      reviewWhere.product     = { storeId };
      reviewPrevWhere.product = { storeId };
    }

    const followWhere: Prisma.StoreFollowWhereInput    = { createdAt: { gte: start } };
    const followPrevWhere: Prisma.StoreFollowWhereInput = { createdAt: { gte: prevStart, lt: start } };
    if (storeId) {
      followWhere.storeId     = storeId;
      followPrevWhere.storeId = storeId;
    }

    const [
      favCount, favPrevCount,
      reviews, reviewPrevCount,
      followCount, followPrevCount,
      repeatBuyers, citiesReached, abandonedBaskets,
    ] = await Promise.all([
      this.prisma.wishlistItem.count({ where: wishWhere }),
      this.prisma.wishlistItem.count({ where: wishPrevWhere }),
      this.prisma.review.findMany({ where: reviewWhere, select: { rating: true } }),
      this.prisma.review.count({ where: reviewPrevWhere }),
      this.prisma.storeFollow.count({ where: followWhere }),
      this.prisma.storeFollow.count({ where: followPrevWhere }),
      this.getRepeatBuyersCount(start, storeId),
      this.getCitiesReachedCount(start, storeId),
      this.getAbandonedBasketsCount(start, storeId),
    ]);

    const avgRating = reviews.length > 0
      ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10 : null;

    return {
      itemFavourites:  favCount,
      shopFollows:     followCount,
      reviewCount:     reviews.length,
      avgRating,
      repeatBuyers,
      citiesReached,
      abandonedBaskets,
      favouritesDelta: this.pctChange(favCount, favPrevCount),
      followsDelta:    this.pctChange(followCount, followPrevCount),
      reviewsDelta:    this.pctChange(reviews.length, reviewPrevCount),
    };
  }

  /** Distinct customers (by userId, falling back to guestEmail) with >1 order in the range. */
  private async getRepeatBuyersCount(start: Date, storeId?: string | null): Promise<number> {
    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: start },
      status:    { notIn: ['CANCELLED', 'REFUNDED'] },
    };
    if (storeId) where.storeOrders = { some: { storeId } };

    const orders = await this.prisma.order.findMany({ where, select: { userId: true, guestEmail: true } });
    const counts = new Map<string, number>();
    for (const o of orders) {
      const key = o.userId ?? o.guestEmail;
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.values()].filter((c) => c > 1).length;
  }

  /** Distinct shipping cities in the range. Order.shippingCity is per-order
   *  (not per-seller), so a store-scoped count reflects the cities of orders
   *  that included at least one of that store's items — a close approximation,
   *  not a precise per-store shipment breakdown. */
  private async getCitiesReachedCount(start: Date, storeId?: string | null): Promise<number> {
    const where: Prisma.OrderWhereInput = {
      createdAt:    { gte: start },
      status:       { notIn: ['CANCELLED', 'REFUNDED'] },
      shippingCity: { not: null },
    };
    if (storeId) where.storeOrders = { some: { storeId } };

    const rows = await this.prisma.order.findMany({
      where,
      select:   { shippingCity: true },
      distinct: ['shippingCity'],
    });
    return rows.length;
  }

  /** Carts with items that went idle (no update) within the requested range.
   *  Uses the same 2h idle threshold as AbandonedCartProcessor's reminder-email
   *  scan, so this stat means the same thing as "abandoned" does elsewhere in
   *  the codebase. (A 24h threshold would make the window `[start, now-24h]`
   *  collapse to ~empty for the "Yesterday" range preset, since start is
   *  itself only 24h back — always reading as zero regardless of real data.) */
  private async getAbandonedBasketsCount(start: Date, storeId?: string | null): Promise<number> {
    const idleCutoff = new Date(Date.now() - 2 * 3600 * 1000);
    return this.prisma.cart.count({
      where: {
        updatedAt: { gte: start, lte: idleCutoff },
        items:     { some: storeId ? { storeId } : {} },
      },
    });
  }

  // ── Conversion funnel (real tracked events) ─────────────────────────────────

  async getConversionFunnel(range: string, storeId?: string | null) {
    const start = this.rangeStart(range);
    const days  = Math.round((Date.now() - start.getTime()) / 86_400_000) || 1;

    const orderWhere: Prisma.OrderWhereInput = {
      createdAt: { gte: start },
      status:    { notIn: ['CANCELLED', 'REFUNDED'] },
    };
    if (storeId) orderWhere.storeOrders = { some: { storeId } };

    const [visits, productViews, addToCart, checkoutStarted, orders] = await Promise.all([
      this.sumRangeMetric(days, 'visits', storeId),
      this.sumRangeMetric(days, 'productViews', storeId),
      this.sumRangeMetric(days, 'addToCart', storeId),
      this.sumRangeMetric(days, 'checkoutStarted', storeId),
      this.prisma.order.count({ where: orderWhere }),
    ]);

    const steps = [
      { stage: 'Visits',          count: visits },
      { stage: 'Product views',   count: productViews },
      { stage: 'Added to cart',   count: addToCart },
      { stage: 'Checkout started',count: checkoutStarted },
      { stage: 'Orders',          count: orders },
    ];

    return steps.map((s) => ({
      ...s,
      // Capped at 100 — a single visit can rack up multiple product views or
      // cart adds, so raw counts can exceed the "Visits" stage; the funnel is
      // meant to show drop-off, not >100% figures.
      percentage: visits > 0 ? Math.min(100, Math.round((s.count / visits) * 100)) : 0,
    }));
  }

  // ── Traffic sources ("How shoppers found you") ──────────────────────────────

  // Matches Etsy's real two-group split: signals the platform brought
  // (search/browse on our own site, other on-platform pages, arriving via
  // an external search engine — i.e. found through SEO) vs signals the
  // seller brought (true direct/bookmarked, social, other external links).
  private static readonly SOURCE_LABELS: Record<string, string> = {
    platform_search: 'Platform search',
    platform_pages:  'Platform app & other pages',
    external_search: 'Platform marketing & SEO',
    direct:          'Direct & other traffic',
    social:          'Social media',
    external:        'External sites',
  };
  private static readonly SOURCE_GROUP: Record<string, 'platform' | 'seller'> = {
    platform_search: 'platform',
    platform_pages:  'platform',
    external_search: 'platform',
    direct:          'seller',
    social:          'seller',
    external:        'seller',
  };

  async getTrafficSources(range: string, storeId?: string | null) {
    const start = this.rangeStart(range);
    const days  = Math.round((Date.now() - start.getTime()) / 86_400_000) || 1;
    const keys  = ['platform_search', 'platform_pages', 'external_search', 'direct', 'social', 'external'] as const;

    const counts = await Promise.all(
      keys.map((k) => this.sumRangeMetric(days, `source:${k}`, storeId)),
    );
    const totalVisits = counts.reduce((s, c) => s + c, 0);
    const platformTotal = keys.reduce((s, k, i) => s + (ShopStatsService.SOURCE_GROUP[k] === 'platform' ? counts[i]! : 0), 0);

    return {
      totalVisits,
      platformBroughtPercentage: totalVisits > 0 ? Math.round((platformTotal / totalVisits) * 100) : 0,
      sellerBroughtPercentage:   totalVisits > 0 ? Math.round(((totalVisits - platformTotal) / totalVisits) * 100) : 0,
      sources: keys.map((key, i) => ({
        key,
        label:      ShopStatsService.SOURCE_LABELS[key],
        group:      ShopStatsService.SOURCE_GROUP[key],
        count:      counts[i],
        percentage: totalVisits > 0 ? Math.round((counts[i]! / totalVisits) * 100) : 0,
      })),
    };
  }

  // ── Listings performance table ─────────────────────────────────────────────

  async getListings(page: number, limit: number, sort: string, storeId?: string) {
    const skip   = (page - 1) * limit;
    const sortBy = this.resolveListingSort(sort);
    const where: Prisma.ProductWhereInput = { deletedAt: null, ...(storeId !== undefined && { storeId }) };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          isActive: true,
          viewCount: true,
          soldCount: true,
          basePrice: true,
          images: {
            where: { isPrimary: true },
            select: { url: true },
            take: 1,
          },
          tags: { select: { tag: { select: { name: true } } }, take: 3 },
          _count: { select: { reviews: true } },
        },
        orderBy: sortBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Aggregate revenue per product from orders
    const productIds = products.map((p) => p.id);
    const revenueAgg = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: { payment: { is: { status: 'PAID' } } },
      },
      _sum: { unitPrice: true },
      _count: { _all: true },
    });
    const revenueMap = new Map(revenueAgg.map((r) => [r.productId, {
      revenue: Number(r._sum.unitPrice ?? 0),
      orders:  r._count._all,
    }]));

    const data = products.map((p) => ({
      productId:  p.id,
      title:      p.name,
      imageUrl:   p.images[0]?.url ?? null,
      views:      p.viewCount,
      favourites: 0,
      orders:     revenueMap.get(p.id)?.orders  ?? 0,
      revenue:    revenueMap.get(p.id)?.revenue ?? 0,
    }));

    // Add favourites count
    const wishlistCounts = await this.prisma.wishlistItem.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _count: { _all: true },
    });
    const wishMap = new Map(wishlistCounts.map((w) => [w.productId, w._count._all]));
    for (const d of data) {
      d.favourites = wishMap.get(d.productId) ?? 0;
    }

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private resolveListingSort(sort: string) {
    switch (sort) {
      case 'views':       return { viewCount: 'desc' as const };
      case 'orders':      return { soldCount: 'desc' as const };
      case 'revenue':     return { soldCount: 'desc' as const };
      case 'favourites':  return { viewCount: 'desc' as const };
      default:            return { createdAt: 'desc' as const };
    }
  }

  // ── Individual listing stats ───────────────────────────────────────────────

  async getListingStats(productId: string, range: string) {
    const start = this.rangeStart(range);
    const days  = Math.round((Date.now() - start.getTime()) / 86_400_000);

    const [product, orderItems, wishlistCount, reviews] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true, name: true, slug: true, status: true, isActive: true,
          viewCount: true, soldCount: true, basePrice: true, compareAtPrice: true,
          createdAt: true,
          images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
        },
      }),
      this.prisma.orderItem.findMany({
        where: {
          productId,
          order: {
            createdAt: { gte: start },
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
            payment: { is: { status: 'PAID' } },
          },
        },
        select: { quantity: true, unitPrice: true, order: { select: { createdAt: true } } },
      }),
      this.prisma.wishlistItem.count({ where: { productId, createdAt: { gte: start } } }),
      this.prisma.review.findMany({
        where: { productId, createdAt: { gte: start } },
        select: { rating: true },
      }),
    ]);

    if (!product) return null;

    const totalOrders  = orderItems.reduce((s, i) => s + i.quantity, 0);
    const totalRevenue = orderItems.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const avgRating    = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

    // Daily time series for the range
    const dailyMap = new Map<string, { visits: number; orders: number; revenue: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = this.dateStr(this.subDays(new Date(), i));
      dailyMap.set(d, { visits: 0, orders: 0, revenue: 0 });
    }
    for (const item of orderItems) {
      const d = this.dateStr(new Date(item.order.createdAt));
      if (dailyMap.has(d)) {
        const row = dailyMap.get(d)!;
        row.orders  += item.quantity;
        row.revenue += Number(item.unitPrice) * item.quantity;
      }
    }
    const timeSeries = [...dailyMap.entries()].map(([date, v]) => ({ date, ...v }));

    return {
      product: {
        id:           product.id,
        name:         product.name,
        slug:         product.slug,
        status:       product.status,
        isActive:     product.isActive,
        imageUrl:     product.images[0]?.url ?? null,
        basePrice:    Number(product.basePrice),
        compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
        createdAt:    product.createdAt,
      },
      summary: {
        views:       product.viewCount,
        orders:      totalOrders,
        revenue:     Math.round(totalRevenue * 100) / 100,
        favourites:  wishlistCount,
        reviews:     reviews.length,
        avgRating,
      },
      timeSeries,
    };
  }

  // ── Search terms ───────────────────────────────────────────────────────────

  async getSearchTerms(limit = 20): Promise<{ term: string; count: number }[]> {
    return this.getTopSearchTerms(limit);
  }

  private async getTopSearchTerms(limit: number): Promise<{ term: string; count: number }[]> {
    if (!this.redis.isAvailable()) return [];
    try {
      const raw = await this.redis.getClient().zrevrangebyscore(
        'search:trending:7d', '+inf', '-inf',
        'WITHSCORES', 'LIMIT', '0', String(limit),
      );
      const result: { term: string; count: number }[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        result.push({ term: raw[i]!, count: Math.round(Number(raw[i + 1] ?? 0)) });
      }
      return result;
    } catch {
      return [];
    }
  }
}
