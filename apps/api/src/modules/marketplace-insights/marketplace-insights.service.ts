import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { SearchService } from '../search/search.service';
import { SearchQueryDto, SearchSortBy } from '../search/dto/search-query.dto';
import { ProductListItemDto } from '../products/dto/product-list-item.dto';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import { PlusFeature } from '@ezihubb/constants';

export type ConversionBucket = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export interface TrendingTermDto {
  term: string;
  searches: number;
  /** % change vs the prior period of equal length, or null if there's no prior data yet. */
  changePercent: number | null;
  /** Thumbnail of a representative listing matching this term (best-selling
   *  match by product name) — null when nothing matches, common for
   *  long-tail terms. Purely decorative, matching Etsy's trending-term cards. */
  imageUrl: string | null;
}

export interface TermDetailDto {
  term: string;
  searches: number;
  resultsCount: number;
  /** Percent, 2dp (e.g. 1.23 = 1.23%). */
  conversionRate: number;
  conversionBucket: ConversionBucket;
  timeSeries: { date: string; searches: number }[];
  relatedTerms: string[];
}

export interface PriceRangeDto {
  min: number;
  max: number;
  /** Interquartile range of matching listing prices — a stand-in for Etsy's
   *  "median purchase price range" until per-order/per-keyword price data
   *  exists; described to callers as the listing price range, not purchase data. */
  typicalLow: number;
  typicalHigh: number;
}

export interface TermAnalysisDto {
  term: string;
  priceRange: PriceRangeDto | null;
  bestsellers: ProductListItemDto[];
  /** Null when the caller has no store in scope (platform-wide view). */
  yourPrices: { min: number; max: number; count: number } | null;
}

export interface QuotaDto {
  used:      number;
  limit:     number;
  remaining: number;
  /** ISO timestamp of the next UTC midnight, when the quota resets. */
  resetsAt:  string;
}

@Injectable()
export class MarketplaceInsightsService {
  /** Etsy-parity: a daily cap on keyword-lookup depth (term-detail page
   *  opens). Only counts opening a term's detail page (getTermDetail), not
   *  the supplementary price/bestseller analysis call the same page also
   *  fires. Two tiers: free stores get DAILY_QUOTA, stores with an active
   *  Ezihubb Plus subscription get PLUS_DAILY_QUOTA — see getQuotaLimit(). */
  private static readonly DAILY_QUOTA = 20;
  private static readonly PLUS_DAILY_QUOTA = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly searchService: SearchService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** No store in scope (platform-wide/SUPER_ADMIN view) always gets the free
   *  tier — there's no store to check a subscription for. */
  private async getQuotaLimit(storeId: string | null): Promise<number> {
    if (!storeId) return MarketplaceInsightsService.DAILY_QUOTA;
    const hasPlus = await this.entitlements.canUseFeature(storeId, PlusFeature.MARKETPLACE_INSIGHTS_EXTENDED_QUOTA);
    return hasPlus ? MarketplaceInsightsService.PLUS_DAILY_QUOTA : MarketplaceInsightsService.DAILY_QUOTA;
  }

  // ── Trending ─────────────────────────────────────────────────────────────

  async getTrending(limit = 20, category?: string): Promise<TrendingTermDto[]> {
    const now = new Date();
    // 30-day windows, inclusive of today: [today-29, today] vs [today-59, today-30] —
    // both exactly 30 days so changePercent compares like-for-like (the DTO promises
    // "prior period of equal length"; off-by-one here would silently bias it high).
    const periodStart = this.dateStr(this.subDays(now, 29));
    const prevPeriodStart = this.dateStr(this.subDays(now, 59));
    const prevPeriodEnd = this.dateStr(this.subDays(now, 30));

    const rows = await this.prisma.searchTermDailyStat.groupBy({
      by: ['term'],
      where: { date: { gte: periodStart }, ...(category && { category }) },
      _sum: { searches: true },
      orderBy: { _sum: { searches: 'desc' } },
      take: limit,
    });

    if (rows.length === 0) return [];

    const terms = rows.map((r) => r.term);
    const prevRows = await this.prisma.searchTermDailyStat.groupBy({
      by: ['term'],
      where: {
        term: { in: terms },
        date: { gte: prevPeriodStart, lte: prevPeriodEnd },
        ...(category && { category }),
      },
      _sum: { searches: true },
    });
    const prevMap = new Map(prevRows.map((r) => [r.term, r._sum.searches ?? 0]));
    const imageMap = await this.getRepresentativeImages(terms);

    return rows.map((r) => {
      const current = r._sum.searches ?? 0;
      const prev = prevMap.get(r.term) ?? 0;
      const changePercent = prev > 0 ? Math.round(((current - prev) / prev) * 1000) / 10 : null;
      return { term: r.term, searches: current, changePercent, imageUrl: imageMap.get(r.term) ?? null };
    });
  }

  /** Best-selling active listing whose name contains each term — a cheap,
   *  direct-name-match lookup (not the full SearchService pipeline) since
   *  this only needs one decorative thumbnail per term, not ranked results. */
  private async getRepresentativeImages(terms: string[]): Promise<Map<string, string | null>> {
    const entries = await Promise.all(
      terms.map(async (term): Promise<[string, string | null]> => {
        const product = await this.prisma.product.findFirst({
          where:   { name: { contains: term, mode: 'insensitive' }, isActive: true, deletedAt: null },
          orderBy: { soldCount: 'desc' },
          select:  { images: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
        });
        return [term, product?.images[0]?.url ?? null];
      }),
    );
    return new Map(entries);
  }

  // ── Search quota ─────────────────────────────────────────────────────────

  private quotaKey(storeId: string | null): string {
    return `marketplace-insights:quota:${storeId ?? 'platform'}:${this.dateStr(new Date())}`;
  }

  private nextUtcMidnight(): Date {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d;
  }

  async getQuota(storeId: string | null): Promise<QuotaDto> {
    const [used, limit] = await Promise.all([
      this.redis.isAvailable()
        ? Number((await this.redis.getClient().get(this.quotaKey(storeId))) ?? 0)
        : Promise.resolve(0),
      this.getQuotaLimit(storeId),
    ]);
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetsAt:  this.nextUtcMidnight().toISOString(),
    };
  }

  /** Fails open (allows the lookup) if Redis is unavailable — a quota outage
   *  must never block sellers from using the tool. The limit is resolved
   *  fresh on every call (never cached in Redis alongside the used-count),
   *  so a store's Plus expiring mid-day correctly drops it to the free
   *  limit on the very next lookup — no special "quota changed mid-cycle"
   *  handling needed, the comparison below just uses whichever limit is
   *  current right now. */
  private async consumeQuota(storeId: string | null): Promise<void> {
    if (!this.redis.isAvailable()) return;
    const limit = await this.getQuotaLimit(storeId);
    const key = this.quotaKey(storeId);
    let used: number;
    try {
      used = await this.redis.getClient().incr(key);
      if (used === 1) await this.redis.getClient().expire(key, 26 * 3600); // safety margin past UTC midnight
    } catch {
      return; // Redis error — fail open
    }
    if (used > limit) {
      throw new ForbiddenException({
        code:    'ERR_INSIGHTS_QUOTA_EXCEEDED',
        message: `Daily search-term lookup limit reached (${limit}/day). Try again tomorrow.`,
      });
    }
  }

  // ── Term deep-dive ───────────────────────────────────────────────────────

  async getTermDetail(term: string, days: number, storeId: string | null): Promise<TermDetailDto> {
    await this.consumeQuota(storeId);
    const normalized = this.normalize(term);
    const startDate = this.dateStr(this.subDays(new Date(), days));

    const [rows, relatedTerms] = await Promise.all([
      this.prisma.searchTermDailyStat.findMany({
        where: { term: normalized, date: { gte: startDate } },
        orderBy: { date: 'asc' },
      }),
      this.searchService.getRelated(normalized),
    ]);

    const searches = rows.reduce((s, r) => s + r.searches, 0);
    const resultsCount = rows.length
      ? Math.round(rows.reduce((s, r) => s + r.resultsCount, 0) / rows.length)
      : 0;
    const purchases = rows.reduce((s, r) => s + r.purchases, 0);

    const rate = searches > 0 ? purchases / searches : 0;

    return {
      term: normalized,
      searches,
      resultsCount,
      conversionRate: Math.round(rate * 10_000) / 100,
      conversionBucket: this.bucketConversion(rate),
      timeSeries: rows.map((r) => ({ date: r.date, searches: r.searches })),
      relatedTerms: relatedTerms.filter((t) => t !== normalized),
    };
  }

  private bucketConversion(rate: number): ConversionBucket {
    if (rate < 0.005) return 'very_low';
    if (rate < 0.01)  return 'low';
    if (rate < 0.03)  return 'medium';
    if (rate < 0.06)  return 'high';
    return 'very_high';
  }

  // ── Term analysis: price benchmarking + bestsellers + your prices ─────────

  async getTermAnalysis(term: string, storeId: string | null): Promise<TermAnalysisDto> {
    const normalized = this.normalize(term);

    const marketQuery = Object.assign(new SearchQueryDto(), {
      q: normalized,
      limit: 48,
      sort: SearchSortBy.BESTSELLER,
    });
    const marketResult = await this.searchService.search(marketQuery);

    const prices = marketResult.data
      .map((p) => p.basePrice)
      .filter((p): p is number => typeof p === 'number' && p > 0)
      .sort((a, b) => a - b);

    const priceRange: PriceRangeDto | null = prices.length
      ? {
          min:        prices[0],
          max:        prices[prices.length - 1],
          typicalLow:  this.percentile(prices, 0.25),
          typicalHigh: this.percentile(prices, 0.75),
        }
      : null;

    let yourPrices: TermAnalysisDto['yourPrices'] = null;
    if (storeId) {
      const storeQuery = Object.assign(new SearchQueryDto(), { q: normalized, limit: 48 });
      const storeResult = await this.searchService.search(storeQuery, storeId);
      const storePrices = storeResult.data
        .map((p) => p.basePrice)
        .filter((p): p is number => typeof p === 'number' && p > 0);
      yourPrices = storePrices.length
        ? { min: Math.min(...storePrices), max: Math.max(...storePrices), count: storePrices.length }
        : { min: 0, max: 0, count: 0 };
    }

    return {
      term: normalized,
      priceRange,
      bestsellers: marketResult.data.slice(0, 12),
      yourPrices,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    return sorted[idx];
  }

  // ── Related-term feedback ───────────────────────────────────────────────

  async submitRelatedTermFeedback(term: string, relatedTerm: string, helpful: boolean): Promise<void> {
    await this.searchService.submitRelatedTermFeedback(term, relatedTerm, helpful);
  }

  // ── Saved searches ───────────────────────────────────────────────────────

  async listSavedSearches(userId: string) {
    return this.prisma.savedSearchTerm.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveSearch(userId: string, term: string) {
    const normalized = this.normalize(term);
    return this.prisma.savedSearchTerm.upsert({
      where: { userId_term: { userId, term: normalized } },
      create: { userId, term: normalized },
      update: {},
    });
  }

  /** Silently no-ops if the id doesn't belong to this user — deleteMany with a
   *  userId filter is itself the ownership check, no separate lookup needed. */
  async deleteSavedSearch(userId: string, id: string): Promise<void> {
    await this.prisma.savedSearchTerm.deleteMany({ where: { id, userId } });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private normalize(term: string): string {
    return term.trim().toLowerCase();
  }

  // UTC-explicit, matching AnalyticsService.dateStr — the `date` strings
  // written into SearchTermDailyStat come from that same UTC-based helper,
  // so period comparisons here have to use the same calendar to line up.
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
