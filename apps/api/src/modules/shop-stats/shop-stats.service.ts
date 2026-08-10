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

  private dateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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
    const start       = this.rangeStart(range);
    const days        = Math.round((Date.now() - start.getTime()) / 86_400_000);
    const productWhere: Prisma.ProductWhereInput = storeId ? { storeId } : {};

    const orderWhere: Prisma.OrderWhereInput = {
      createdAt: { gte: start },
      status:    { notIn: ['CANCELLED', 'REFUNDED'] },
    };
    if (storeId) orderWhere.storeOrders = { some: { storeId } };

    const [totalOrders, orderSum, totalVisits, timeSeries] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.aggregate({ where: orderWhere, _sum: { total: true } }),
      this.prisma.product.aggregate({ _sum: { viewCount: true }, where: productWhere }),
      storeId
        ? this.getStoreOrderTimeSeries(storeId, start, days)
        : this.getDailyTimeSeries(days),
    ]);

    const totalRevenue = Number(orderSum._sum?.total ?? 0);
    const visits       = Number(totalVisits._sum?.viewCount ?? 0);
    const conversion   = visits > 0 ? ((totalOrders / visits) * 100) : 0;

    return {
      visits,
      orders:         totalOrders,
      revenue:        totalRevenue,
      conversionRate: Math.round(conversion * 10) / 10,
      timeSeries,
    };
  }

  /** DB-computed daily time series for a specific store (no Redis dependency). */
  private async getStoreOrderTimeSeries(storeId: string, start: Date, days: number) {
    const orders = await this.prisma.order.findMany({
      where: { storeOrders: { some: { storeId } }, createdAt: { gte: start }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      select: { createdAt: true, total: true },
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
        row.revenue += Number(o.total);
      }
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

  async getShopperStats(range: string, storeId?: string | null) {
    const start = this.rangeStart(range);

    const wishWhere: Prisma.WishlistItemWhereInput = { createdAt: { gte: start } };
    const reviewWhere: Prisma.ReviewWhereInput     = { createdAt: { gte: start } };
    if (storeId) {
      wishWhere.product   = { storeId };
      reviewWhere.product = { storeId };
    }

    const orderActivityWhere: Prisma.OrderWhereInput = { createdAt: { gte: start } };
    if (storeId) orderActivityWhere.storeOrders = { some: { storeId } };

    const [favCount, reviews, followCount] = await Promise.all([
      this.prisma.wishlistItem.count({ where: wishWhere }),
      this.prisma.review.findMany({ where: reviewWhere, select: { rating: true } }),
      // Shop owner: count orders as proxy for customer activity; platform: new signups
      storeId
        ? this.prisma.order.count({ where: orderActivityWhere })
        : this.prisma.user.count({ where: { createdAt: { gte: start } } }),
    ]);

    const avgRating = reviews.length > 0
      ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10 : null;

    return {
      itemFavourites:  favCount,
      shopFollows:     followCount,
      reviewCount:     reviews.length,
      avgRating,
      favouritesDelta: 0,
      followsDelta:    0,
      reviewsDelta:    0,
    };
  }

  // ── Traffic sources (simplified) ────────────────────────────────────────────

  async getTrafficSources(range: string, storeId?: string | null) {
    const storeFilter = storeId ? { storeId } : {};
    const visits      = await this.prisma.product.aggregate({ _sum: { viewCount: true }, where: storeFilter });
    const total       = Number(visits._sum.viewCount ?? 0);

    // Get top search terms to estimate organic/search traffic
    const searchTerms = await this.getTopSearchTerms(7);
    const searchVisits = searchTerms.reduce((s, t) => s + t.count, 0);

    // Estimated breakdown (simplified, no real tracking granularity)
    const direct  = Math.round(total * 0.16);
    const search  = Math.min(searchVisits, Math.round(total * 0.25));
    const social  = Math.round(total * 0.05);
    const organic = Math.max(0, total - direct - search - social);

    return [
      { source: 'Direct & other traffic', visits: direct,  percentage: total > 0 ? Math.round(direct  / total * 100) : 0 },
      { source: 'Organic search',         visits: organic, percentage: total > 0 ? Math.round(organic / total * 100) : 0 },
      { source: 'Internal search',        visits: search,  percentage: total > 0 ? Math.round(search  / total * 100) : 0 },
      { source: 'Social media',           visits: social,  percentage: total > 0 ? Math.round(social  / total * 100) : 0 },
    ];
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
      where: { productId: { in: productIds } },
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
          order: { createdAt: { gte: start }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
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
