import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { QUEUES, AI_JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';

interface PricingRecommendation {
  productId:        string;
  currentPrice:     number;
  recommendedPrice: number;
  minPrice:         number;
  maxPrice:         number;
  reasoning:        string;
  confidenceScore:  number;
}

const COMPETITOR_CACHE_TTL = 24 * 60 * 60; // 24h

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private readonly anthropicKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUES.AI_FEATURES) private readonly aiQueue: Queue,
  ) {
    this.anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY') ?? '';
  }

  // ── Get pricing recommendation ────────────────────────────────────────────

  async analyzePricing(productId: string, storeId: string): Promise<PricingRecommendation> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      select: {
        id: true, name: true, basePrice: true, soldCount: true, viewCount: true,
        category: { select: { name: true } },
        store: { select: { performanceScore: true } },
        tags: { include: { tag: true }, take: 5 },
      },
    });
    if (!product) throw new Error('Product not found');

    const currentPrice = Number(product.basePrice);
    const conversionRate = product.viewCount > 0
      ? (product.soldCount / product.viewCount) * 100 : 0;

    // Get platform avg conversion for all active products
    const platformAvg = await this.prisma.product.aggregate({
      where: {
        viewCount: { gt: 0 },
        status:    'ACTIVE',
      },
      _avg: { soldCount: true, viewCount: true },
    });
    const platformAvgConversion = platformAvg._avg.viewCount && platformAvg._avg.viewCount > 0
      ? ((platformAvg._avg.soldCount ?? 0) / platformAvg._avg.viewCount) * 100 : 5;

    // Similar products on platform (within 50%–200% of current price)
    const similarProducts = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        basePrice: {
          gte: currentPrice * 0.5,
          lte: currentPrice * 2.0,
        },
      },
      select: { basePrice: true, soldCount: true, viewCount: true },
      take: 20,
    });

    const competitorPrices = similarProducts.map(p => Number(p.basePrice));

    // Claude analysis
    const recommendation = await this.callClaudeForPricing({
      currentPrice,
      conversionRate:         Math.round(conversionRate * 100) / 100,
      competitorPrices,
      platformAvgConversion:  Math.round(platformAvgConversion * 100) / 100,
      sellerPerformanceScore: product.store?.performanceScore ?? null,
      productCategory:        product.category.name,
      productName:            product.name,
    });

    // Cache recommendation for 24h
    await this.redis.set(
      `pricing:rec:${productId}`,
      recommendation,
      COMPETITOR_CACHE_TTL,
    );

    return { productId, currentPrice, ...recommendation };
  }

  private async callClaudeForPricing(data: {
    currentPrice:           number;
    conversionRate:         number;
    competitorPrices:       number[];
    platformAvgConversion:  number;
    sellerPerformanceScore: number | null;
    productCategory:        string;
    productName:            string;
  }): Promise<Omit<PricingRecommendation, 'productId' | 'currentPrice'>> {
    const avgCompetitor = data.competitorPrices.length > 0
      ? data.competitorPrices.reduce((s, p) => s + p, 0) / data.competitorPrices.length
      : data.currentPrice;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'x-api-key':         this.anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5',
          max_tokens: 500,
          system: `You are a pricing analyst for a handmade goods marketplace.
Analyze data and return ONLY valid JSON with exactly these fields:
{
  "recommendedPrice": number,
  "minPrice": number,
  "maxPrice": number,
  "reasoning": "1-2 sentence explanation",
  "confidenceScore": 0.0-1.0
}`,
          messages: [{
            role:    'user',
            content: `Analyze pricing for: "${data.productName}" (${data.productCategory})
Current price: $${data.currentPrice}
Conversion rate: ${data.conversionRate}% (platform avg: ${data.platformAvgConversion}%)
Platform similar products avg price: $${avgCompetitor.toFixed(2)}
Seller performance score: ${data.sellerPerformanceScore ?? 'N/A'}/100
Recommend optimal price.`,
          }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        this.logger.warn(`Claude API returned ${res.status} — using fallback pricing`);
        return this.fallbackRecommendation(data.currentPrice);
      }

      const json: { content: { type: string; text: string }[] } = await res.json();
      const text = json.content.find(c => c.type === 'text')?.text ?? '{}';
      return JSON.parse(text);
    } catch (err) {
      this.logger.error('Claude pricing call failed', err);
      return this.fallbackRecommendation(data.currentPrice);
    }
  }

  private fallbackRecommendation(currentPrice: number): Omit<PricingRecommendation, 'productId' | 'currentPrice'> {
    return {
      recommendedPrice: currentPrice,
      minPrice:         Math.round(currentPrice * 0.8 * 100) / 100,
      maxPrice:         Math.round(currentPrice * 1.3 * 100) / 100,
      reasoning:        'Analysis unavailable. Using current price.',
      confidenceScore:  0.3,
    };
  }

  // ── A/B Test ──────────────────────────────────────────────────────────────

  async startABTest(productId: string, storeId: string): Promise<{ testId: string }> {
    // Ensure we have a recommendation (use cache or generate fresh)
    const cached = await this.redis.get(`pricing:rec:${productId}`);
    if (!cached) {
      await this.analyzePricing(productId, storeId);
    }

    const rec = await this.redis.get(`pricing:rec:${productId}`) as PricingRecommendation | null;
    if (!rec) throw new Error('No recommendation available');

    const product = await this.prisma.product.findFirst({
      where:  { id: productId, storeId },
      select: { basePrice: true },
    });
    if (!product) throw new Error('Product not found');

    // Cancel any running test for this product
    await this.prisma.aBPricingTest.updateMany({
      where: { productId, status: 'RUNNING' },
      data:  { status: 'CANCELLED' },
    });

    const test = await this.prisma.aBPricingTest.create({
      data: {
        productId,
        variantA: product.basePrice,
        variantB: rec.recommendedPrice,
        endsAt:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { testId: test.id };
  }

  async recordImpression(productId: string, userId: string): Promise<{ variant: 'A' | 'B'; price: number } | null> {
    const test = await this.prisma.aBPricingTest.findFirst({
      where: { productId, status: 'RUNNING' },
    });
    if (!test) return null;

    // Deterministic variant assignment via simple hash
    const hash = Buffer.from(userId + test.id).reduce((s, b) => s + b, 0);
    const variant: 'A' | 'B' = hash % 2 === 0 ? 'A' : 'B';
    const price = variant === 'A' ? Number(test.variantA) : Number(test.variantB);

    await this.prisma.aBPricingTest.update({
      where: { id: test.id },
      data:  variant === 'A'
        ? { impressionsA: { increment: 1 } }
        : { impressionsB: { increment: 1 } },
    });

    return { variant, price };
  }

  async recordConversion(productId: string, userId: string): Promise<void> {
    const test = await this.prisma.aBPricingTest.findFirst({
      where: { productId, status: 'RUNNING' },
    });
    if (!test) return;

    const hash = Buffer.from(userId + test.id).reduce((s, b) => s + b, 0);
    const variant: 'A' | 'B' = hash % 2 === 0 ? 'A' : 'B';

    await this.prisma.aBPricingTest.update({
      where: { id: test.id },
      data:  variant === 'A'
        ? { conversionsA: { increment: 1 } }
        : { conversionsB: { increment: 1 } },
    });
  }

  async resolveExpiredTests(): Promise<void> {
    const expiredTests = await this.prisma.aBPricingTest.findMany({
      where: { status: 'RUNNING', endsAt: { lte: new Date() } },
      include: {
        product: {
          select: {
            id: true,
            storeId: true,
            store: {
              select: {
                owner: { select: { email: true, firstName: true } },
              },
            },
          },
        },
      },
    });

    for (const test of expiredTests) {
      const convRateA = test.impressionsA > 0 ? test.conversionsA / test.impressionsA : 0;
      const convRateB = test.impressionsB > 0 ? test.conversionsB / test.impressionsB : 0;
      const minImpressions = 50;

      // Not enough data — cancel
      if (test.impressionsA < minImpressions || test.impressionsB < minImpressions) {
        await this.prisma.aBPricingTest.update({
          where: { id: test.id },
          data:  { status: 'CANCELLED' },
        });
        continue;
      }

      const winner: 'A' | 'B' = convRateB > convRateA ? 'B' : 'A';
      const winnerPrice = winner === 'A' ? test.variantA : test.variantB;

      await this.prisma.aBPricingTest.update({
        where: { id: test.id },
        data:  { status: winner === 'A' ? 'WINNER_A' : 'WINNER_B', winnerId: winner },
      });

      // Auto-apply winner price if configured
      if (test.autoApplyWinner) {
        await this.prisma.product.update({
          where: { id: test.productId },
          data:  { basePrice: winnerPrice },
        });
      }

      // Notify seller via email queue
      const ownerEmail = test.product.store?.owner?.email;
      if (ownerEmail) {
        await this.emailQueue.add(
          'send-email',
          {
            to:       ownerEmail,
            template: 'ab-test-result',
            subject:  'Your A/B pricing test has a winner!',
            data: {
              firstName:    test.product.store?.owner?.firstName ?? 'Seller',
              productId:    test.productId,
              winner,
              winnerPrice:  Number(winnerPrice),
              convRateA:    Math.round(convRateA * 10000) / 100,
              convRateB:    Math.round(convRateB * 10000) / 100,
              autoApplied:  test.autoApplyWinner,
            },
          },
          DEFAULT_JOB_OPTIONS,
        );
      }
    }
  }

  async getTestStatus(productId: string, storeId: string) {
    return this.prisma.aBPricingTest.findFirst({
      where:   { productId, product: { storeId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecommendation(productId: string, storeId: string) {
    const cached = await this.redis.get(`pricing:rec:${productId}`);
    if (cached) return cached;
    return this.analyzePricing(productId, storeId);
  }

  // ── Admin methods ─────────────────────────────────────────────────────────

  async getAdminStats() {
    const [activeTests, completedTests, totalProductsTested, liftAgg] = await Promise.all([
      this.prisma.aBPricingTest.count({ where: { status: 'RUNNING' } }),
      this.prisma.aBPricingTest.count({ where: { status: { in: ['WINNER_A', 'WINNER_B', 'CANCELLED'] } } }),
      this.prisma.aBPricingTest.findMany({
        distinct:  ['productId'],
        select:    { productId: true },
      }).then((r) => r.length),
      // Average revenue & conversion lift from completed tests that have impression data
      this.prisma.aBPricingTest.findMany({
        where: { status: { in: ['WINNER_A', 'WINNER_B'] }, impressionsA: { gt: 0 }, impressionsB: { gt: 0 } },
        select: { variantA: true, variantB: true, impressionsA: true, impressionsB: true, conversionsA: true, conversionsB: true },
      }),
    ]);

    let avgRevenueUplift: number | null    = null;
    let avgConversionUplift: number | null = null;

    if (Array.isArray(liftAgg) && liftAgg.length > 0) {
      const lifts = liftAgg.map((t) => {
        const convA = t.impressionsA > 0 ? t.conversionsA / t.impressionsA : 0;
        const convB = t.impressionsB > 0 ? t.conversionsB / t.impressionsB : 0;
        const revA  = convA * Number(t.variantA);
        const revB  = convB * Number(t.variantB);
        return {
          convLift: convA > 0 ? ((convB - convA) / convA) * 100 : 0,
          revLift:  revA  > 0 ? ((revB  - revA)  / revA)  * 100 : 0,
        };
      });
      avgConversionUplift = lifts.reduce((s, l) => s + l.convLift, 0) / lifts.length;
      avgRevenueUplift    = lifts.reduce((s, l) => s + l.revLift,  0) / lifts.length;
    }

    return { activeTests, completedTests, totalProductsTested, avgRevenueUplift, avgConversionUplift };
  }

  async listTests(page = 1, limit = 20, status?: string) {
    const statusFilter = status && status !== 'ALL' ? this.mapUiStatus(status) : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = statusFilter ? { status: { in: statusFilter } } : undefined;

    const [raw, total] = await Promise.all([
      this.prisma.aBPricingTest.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.aBPricingTest.count({ where }),
    ]);

    const data = raw.map((t) => {
      const convA = t.impressionsA > 0 ? t.conversionsA / t.impressionsA : 0;
      const convB = t.impressionsB > 0 ? t.conversionsB / t.impressionsB : 0;
      const revA  = convA * Number(t.variantA);
      const revB  = convB * Number(t.variantB);
      return {
        id:            t.id,
        productId:     t.productId,
        productTitle:  t.product?.name ?? t.productId,
        controlPrice:  Number(t.variantA),
        variantPrice:  Number(t.variantB),
        status:        this.mapDbStatus(t.status),
        startedAt:     t.createdAt,
        endedAt:       t.status !== 'RUNNING' ? t.updatedAt : null,
        controlRevenue: revA || null,
        variantRevenue: revB || null,
        conversionLift: convA > 0 ? ((convB - convA) / convA) * 100 : null,
        revenueLift:    revA  > 0 ? ((revB  - revA)  / revA)  * 100 : null,
      };
    });

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  private mapUiStatus(ui: string): string[] {
    switch (ui) {
      case 'ACTIVE':    return ['RUNNING'];
      case 'COMPLETED': return ['WINNER_A', 'WINNER_B'];
      case 'REVERTED':  return ['CANCELLED'];
      default:          return [];
    }
  }

  private mapDbStatus(db: string): 'ACTIVE' | 'COMPLETED' | 'REVERTED' {
    if (db === 'RUNNING')                   return 'ACTIVE';
    if (db === 'WINNER_A' || db === 'WINNER_B') return 'COMPLETED';
    return 'REVERTED';
  }

  async cancelTest(id: string) {
    return this.prisma.aBPricingTest.update({
      where: { id },
      data:  { status: 'CANCELLED' },
    });
  }

  async revertTest(id: string) {
    const test = await this.prisma.aBPricingTest.findUniqueOrThrow({
      where:  { id },
      select: { productId: true, variantA: true },
    });
    await this.prisma.product.update({
      where: { id: test.productId },
      data:  { basePrice: test.variantA },
    });
    return this.prisma.aBPricingTest.update({
      where: { id },
      data:  { status: 'CANCELLED' },
    });
  }

  async queueAnalysis(productId: string, storeId: string) {
    return this.aiQueue.add(
      AI_JOBS.ANALYZE_PRICING,
      { productId, storeId },
      DEFAULT_JOB_OPTIONS,
    );
  }

  // ── Admin helpers (no store session required — look up storeId from product) ──

  private async getStoreIdForProduct(productId: string): Promise<string> {
    const product = await this.prisma.product.findUnique({
      where:  { id: productId },
      select: { storeId: true },
    });
    if (!product?.storeId) throw new Error(`Product ${productId} has no associated store`);
    return product.storeId;
  }

  async adminGetRecommendation(productId: string) {
    const storeId = await this.getStoreIdForProduct(productId);
    return this.getRecommendation(productId, storeId);
  }

  async adminStartABTest(productId: string) {
    const storeId = await this.getStoreIdForProduct(productId);
    return this.startABTest(productId, storeId);
  }

  async adminGetTestStatus(productId: string) {
    const storeId = await this.getStoreIdForProduct(productId);
    return this.getTestStatus(productId, storeId);
  }
}
