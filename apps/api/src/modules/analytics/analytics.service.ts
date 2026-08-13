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

  // ── Per-shop metric tracking (store visits, product views, cart/checkout funnel) ──

  async trackStoreMetric(
    storeId: string,
    metric: 'visits' | 'productViews' | 'addToCart' | 'checkoutStarted',
  ): Promise<void> {
    if (!this.redis.isAvailable()) return;
    const today = this.dateStr(new Date());
    const storeKey = `analytics:store:${storeId}:${today}:${metric}`;
    const platformKey = `analytics:${metric}:${today}`;
    try {
      await Promise.all([
        this.redis.getClient().incr(storeKey),
        this.redis.getClient().incr(platformKey),
        this.redis.getClient().expire(storeKey, 90 * 24 * 3600),
        this.redis.getClient().expire(platformKey, 90 * 24 * 3600),
      ]);
    } catch (err) {
      this.logger.warn(`trackStoreMetric(${metric}) Redis error: ${(err as Error).message}`);
    }
  }

  /**
   * Per-store + platform-wide daily counter for the "How shoppers found you"
   * traffic-source breakdown. Both keys deliberately match the
   * `analytics:store:{storeId}:{date}:{metric}` / `analytics:{metric}:{date}`
   * shape `ShopStatsService.sumRangeMetric()` already reads, with
   * `metric = "source:{bucket}"` — lets the reader reuse that helper as-is.
   */
  async trackVisitSource(
    storeId: string,
    source: 'search' | 'direct' | 'social' | 'external',
  ): Promise<void> {
    if (!this.redis.isAvailable()) return;
    const today = this.dateStr(new Date());
    const storeKey = `analytics:store:${storeId}:${today}:source:${source}`;
    const platformKey = `analytics:source:${source}:${today}`;
    try {
      await Promise.all([
        this.redis.getClient().incr(storeKey),
        this.redis.getClient().incr(platformKey),
        this.redis.getClient().expire(storeKey, 90 * 24 * 3600),
        this.redis.getClient().expire(platformKey, 90 * 24 * 3600),
      ]);
    } catch (err) {
      this.logger.warn(`trackVisitSource(${source}) Redis error: ${(err as Error).message}`);
    }
  }

  // ── Search analytics ────────────────────────────────────────────────────────
  // Single source of truth for search tracking — SearchService used to also
  // write its own separate 'search:trending' zset on every query, duplicating
  // this one under a different key for no reason. getTrending()/getRelated()
  // now read 'search:trending:7d' (below) instead.

  async trackSearch(query: string, resultCount: number, category?: string): Promise<void> {
    if (!query?.trim() || !this.redis.isAvailable()) return;
    const normalized = query.trim().toLowerCase();
    const client = this.redis.getClient();
    const today = this.dateStr(new Date());
    try {
      const ops: Promise<unknown>[] = [
        client.zincrby('search:trending:7d', 1, normalized),
        client.expire('search:trending:7d', 7 * 24 * 3600),
        // Per-day counters, flushed into SearchTermDailyStat by the nightly
        // job (flushDailySearchStats) then deleted — short TTL here is just
        // a safety net in case a flush is ever missed.
        client.zincrby(`search:volume:${today}`, 1, normalized),
        client.expire(`search:volume:${today}`, 3 * 24 * 3600),
        client.hset(`search:results:${today}`, normalized, resultCount),
        client.expire(`search:results:${today}`, 3 * 24 * 3600),
      ];
      if (category) {
        // Last-write-wins per term per day — a reasonable approximation
        // since a given term's matching results (and thus dominant category)
        // rarely shift category across searches on the same day.
        ops.push(
          client.hset(`search:category:${today}`, normalized, category),
          client.expire(`search:category:${today}`, 3 * 24 * 3600),
        );
      }
      await Promise.all(ops);
      if (resultCount === 0) {
        await client.zincrby('search:zero_results', 1, normalized);
      }
    } catch (err) {
      this.logger.warn(`trackSearch Redis error: ${(err as Error).message}`);
    }
  }

  /** Fired when a buyer lands on a product page via a search-result link (?st=term). */
  async trackSearchClick(query: string): Promise<void> {
    if (!query?.trim() || !this.redis.isAvailable()) return;
    const normalized = query.trim().toLowerCase();
    const today = this.dateStr(new Date());
    try {
      const client = this.redis.getClient();
      await client.zincrby(`search:clicks:${today}`, 1, normalized);
      await client.expire(`search:clicks:${today}`, 3 * 24 * 3600);
    } catch (err) {
      this.logger.warn(`trackSearchClick Redis error: ${(err as Error).message}`);
    }
  }

  /**
   * Nightly: fold the given day's Redis search counters into durable
   * SearchTermDailyStat rows, then clear the Redis keys. Purchases are
   * computed straight from OrderItem.searchTerm (already persisted at
   * checkout) rather than a separate Redis counter, so there's one source of
   * truth for that number instead of two that could drift apart.
   */
  async flushDailySearchStats(date: string): Promise<{ termsFlushed: number }> {
    if (!this.redis.isAvailable()) return { termsFlushed: 0 };
    const client = this.redis.getClient();

    const [volumeRows, resultsHash, clickRows, categoryHash] = await Promise.all([
      client.zrange(`search:volume:${date}`, 0, -1, 'WITHSCORES'),
      client.hgetall(`search:results:${date}`),
      client.zrange(`search:clicks:${date}`, 0, -1, 'WITHSCORES'),
      client.hgetall(`search:category:${date}`),
    ]);

    const searches = new Map<string, number>();
    for (let i = 0; i < volumeRows.length; i += 2) {
      searches.set(volumeRows[i], Number(volumeRows[i + 1]));
    }
    const clicks = new Map<string, number>();
    for (let i = 0; i < clickRows.length; i += 2) {
      clicks.set(clickRows[i], Number(clickRows[i + 1]));
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const purchaseRows = await this.prisma.orderItem.groupBy({
      by: ['searchTerm'],
      where: { searchTerm: { not: null }, createdAt: { gte: dayStart, lte: dayEnd } },
      _count: { searchTerm: true },
    });
    const purchases = new Map<string, number>();
    for (const row of purchaseRows) {
      if (row.searchTerm) purchases.set(row.searchTerm, row._count.searchTerm);
    }

    const allTerms = new Set<string>([
      ...searches.keys(),
      ...clicks.keys(),
      ...purchases.keys(),
    ]);

    for (const term of allTerms) {
      await this.prisma.searchTermDailyStat.upsert({
        where: { term_date: { term, date } },
        create: {
          term,
          date,
          searches:     searches.get(term) ?? 0,
          resultsCount: Number(resultsHash?.[term] ?? 0),
          clicks:       clicks.get(term) ?? 0,
          purchases:    purchases.get(term) ?? 0,
          category:     categoryHash?.[term] ?? null,
        },
        update: {
          searches:     searches.get(term) ?? 0,
          resultsCount: Number(resultsHash?.[term] ?? 0),
          clicks:       clicks.get(term) ?? 0,
          purchases:    purchases.get(term) ?? 0,
          category:     categoryHash?.[term] ?? null,
        },
      }).catch((err: Error) =>
        this.logger.warn(`SearchTermDailyStat upsert failed (${term}, ${date}): ${err.message}`),
      );
    }

    await client
      .del(`search:volume:${date}`, `search:results:${date}`, `search:clicks:${date}`, `search:category:${date}`)
      .catch(() => undefined);

    return { termsFlushed: allTerms.size };
  }

  /** 90-day retention for SearchTermDailyStat — called by the same nightly job. */
  async cleanupOldSearchStats(): Promise<{ deleted: number }> {
    const cutoff = this.dateStr(this.subDays(new Date(), 90));
    const result = await this.prisma.searchTermDailyStat.deleteMany({
      where: { date: { lt: cutoff } },
    });
    return { deleted: result.count };
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

  // UTC-explicit (not local time) — flushDailySearchStats compares this
  // against OrderItem.createdAt using explicit `${date}T00:00:00.000Z`
  // boundaries, so the two have to agree on what "day" a timestamp falls in
  // regardless of the container's TZ setting. Production runs UTC today, so
  // this is a no-op in practice, but local-time getters here would silently
  // misattribute purchases near midnight the moment that ever changes.
  private dateStr(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private subDays(d: Date, days: number): Date {
    const result = new Date(d);
    result.setUTCDate(result.getUTCDate() - days);
    return result;
  }
}
