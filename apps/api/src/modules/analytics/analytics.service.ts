import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

interface GA4Event {
  name: string;
  params: Record<string, unknown>;
}

type OrderForAnalytics = {
  id: string;
  orderNumber: string;
  total: number;
  items: { productId: string; quantity: number }[];
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── Revenue tracking ────────────────────────────────────────────────────────

  async trackOrderConfirmed(order: OrderForAnalytics): Promise<void> {
    const today = this.dateStr(new Date());

    if (this.redis.isAvailable()) {
      const client = this.redis.getClient();
      try {
        await Promise.all([
          client.incrbyfloat(`analytics:revenue:${today}`, order.total),
          client.incr(`analytics:orders:${today}`),
          client.expire(`analytics:revenue:${today}`, 90 * 24 * 3600),
          client.expire(`analytics:orders:${today}`, 90 * 24 * 3600),
        ]);
      } catch (err) {
        this.logger.warn(`Revenue Redis error: ${(err as Error).message}`);
      }
    }

    // Update product soldCount in DB
    for (const item of order.items) {
      await this.prisma.product
        .update({
          where: { id: item.productId },
          data: { soldCount: { increment: item.quantity } },
        })
        .catch((err: Error) =>
          this.logger.warn(`soldCount update failed (${item.productId}): ${err.message}`),
        );
    }

    // 24h sold leaderboard for "X sold today" badge
    if (this.redis.isAvailable()) {
      try {
        const pipe = this.redis.getClient().pipeline();
        for (const item of order.items) {
          pipe.zincrby('product:sold:24h', item.quantity, item.productId);
        }
        pipe.expire('product:sold:24h', 24 * 3600);
        await pipe.exec();
      } catch (err) {
        this.logger.warn(`24h sold pipeline error: ${(err as Error).message}`);
      }
    }
  }

  // ── Search analytics ────────────────────────────────────────────────────────

  async trackSearch(query: string, resultCount: number): Promise<void> {
    if (!query?.trim() || !this.redis.isAvailable()) return;
    const normalized = query.trim().toLowerCase();
    const client = this.redis.getClient();
    try {
      await client.zincrby('search:trending:7d', 1, normalized);
      await client.expire('search:trending:7d', 7 * 24 * 3600);
      if (resultCount === 0) {
        await client.zincrby('search:zero_results', 1, normalized);
      }
    } catch (err) {
      this.logger.warn(`trackSearch Redis error: ${(err as Error).message}`);
    }
  }

  // ── Product view tracking ───────────────────────────────────────────────────

  async trackProductView(productId: string, userId?: string): Promise<void> {
    const key = `viewed:${userId ?? 'anon'}:${productId}`;
    if (this.redis.isAvailable()) {
      const client = this.redis.getClient();
      try {
        const alreadyCounted = await client.get(key);
        if (alreadyCounted) return;
        await client.set(key, '1', 'EX', 1800); // 30-min dedup window
      } catch {
        // Fall through to DB update even if Redis check fails
      }
    }
    await this.prisma.product
      .update({ where: { id: productId }, data: { viewCount: { increment: 1 } } })
      .catch((err: Error) =>
        this.logger.warn(`viewCount update failed (${productId}): ${err.message}`),
      );
  }

  // ── Recently viewed (per user) ──────────────────────────────────────────────

  async trackRecentlyViewed(userId: string, productId: string): Promise<void> {
    if (!this.redis.isAvailable()) return;
    const key = `user:${userId}:recently_viewed`;
    try {
      const client = this.redis.getClient();
      await client.zadd(key, Date.now(), productId);
      await client.zremrangebyrank(key, 0, -9); // keep last 8
      await client.expire(key, 30 * 24 * 3600);
    } catch (err) {
      this.logger.warn(`trackRecentlyViewed error: ${(err as Error).message}`);
    }
  }

  async getRecentlyViewed(userId: string): Promise<string[]> {
    if (!this.redis.isAvailable()) return [];
    try {
      return await this.redis.getClient().zrevrange(`user:${userId}:recently_viewed`, 0, 7);
    } catch {
      return [];
    }
  }

  // ── Revenue dashboard ───────────────────────────────────────────────────────

  async getDailyRevenue(days: number): Promise<{ date: string; revenue: number; orders: number }[]> {
    const result: { date: string; revenue: number; orders: number }[] = [];
    const client = this.redis.isAvailable() ? this.redis.getClient() : null;
    for (let i = days - 1; i >= 0; i--) {
      const date = this.dateStr(this.subDays(new Date(), i));
      let revenue = 0;
      let orders = 0;
      if (client) {
        try {
          const [rev, ord] = await Promise.all([
            client.get(`analytics:revenue:${date}`),
            client.get(`analytics:orders:${date}`),
          ]);
          revenue = Number(rev ?? 0);
          orders = Number(ord ?? 0);
        } catch { /* no-op */ }
      }
      result.push({ date, revenue, orders });
    }
    return result;
  }

  // ── Admin badge counts ──────────────────────────────────────────────────────

  async getBadgeCounts(): Promise<{ pendingOrders: number; pendingReviews: number; unreadMessages: number }> {
    const [pendingOrders, pendingReviews] = await Promise.all([
      this.prisma.order.count({
        where: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.IN_PRODUCTION] } },
      }),
      this.prisma.review.count({ where: { status: 'PENDING' } }),
    ]);
    return { pendingOrders, pendingReviews, unreadMessages: 0 };
  }

  // ── GA4 Measurement Protocol (server-to-server) ─────────────────────────────

  async sendToGA4(clientId: string, events: GA4Event[]): Promise<void> {
    const measurementId = process.env.GA_MEASUREMENT_ID;
    const apiSecret = process.env.GA_API_SECRET;
    if (!measurementId || !apiSecret) return;
    try {
      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
        {
          method: 'POST',
          body: JSON.stringify({ client_id: clientId, events }),
        },
      );
    } catch {
      // Non-critical: don't fail order if GA is down
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private dateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private subDays(d: Date, days: number): Date {
    const result = new Date(d);
    result.setDate(result.getDate() - days);
    return result;
  }
}
