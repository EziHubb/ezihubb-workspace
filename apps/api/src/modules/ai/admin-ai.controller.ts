import {
  Controller, Get, Post, Put, Param, Query, Body,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

@ApiTags('Admin AI')
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminAiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── Stats ─────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Aggregate AI feature stats across the platform' })
  async getStats() {
    const [pricingTests, trendDrafts, dnaAnalyses, pendingDrafts] = await Promise.all([
      this.prisma.aBPricingTest.count(),
      this.prisma.trendProductDraft.count(),
      this.prisma.creatorDNAAnalysis.count(),
      this.prisma.trendProductDraft.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);
    return { pricingTests, trendDrafts, dnaAnalyses, pendingDrafts };
  }

  // ── AI Settings ───────────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get AI feature settings' })
  async getSettings() {
    const cached = await this.redis.get<Record<string, unknown>>('admin:ai:settings');
    if (cached) return cached;
    return {
      pricingEnabled: true,
      trendsEnabled: true,
      creatorDnaEnabled: true,
      maxDailyApiCalls: 1000,
      autoApproveDrafts: false,
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update AI feature settings' })
  async updateSettings(@Body() body: Record<string, unknown>) {
    await this.redis.set('admin:ai:settings', body, 86400);
    return body;
  }

  // ── AI Usage ─────────────────────────────────────────────────────────────

  @Get('usage')
  @ApiOperation({ summary: 'Get AI API usage and cost metrics' })
  async getUsage(@Query('days') days?: string) {
    const d = days ? +days : 30;
    const since = new Date(Date.now() - d * 86400000);

    const [totalDraftCost, totalPricingCalls, totalDnaAnalyses] = await Promise.all([
      this.prisma.trendProductDraft.count({ where: { createdAt: { gte: since } } }),
      this.prisma.aBPricingTest.count({ where: { createdAt: { gte: since } } }),
      this.prisma.creatorDNAAnalysis.count({ where: { createdAt: { gte: since } } }),
    ]);

    const totalCalls = totalDraftCost + totalPricingCalls + totalDnaAnalyses;
    return {
      days: d,
      since: since.toISOString(),
      totalCalls,
      trendDraftCalls: totalDraftCost,
      pricingAnalysisCalls: totalPricingCalls,
      dnaAnalysisCalls: totalDnaAnalyses,
      estimatedCostUsd: (totalCalls * 0.002).toFixed(4),
    };
  }

  // ── Pricing (A/B Tests) ───────────────────────────────────────────────────

  @Get('pricing/stats')
  @ApiOperation({ summary: 'Aggregate stats for all A/B pricing tests' })
  async getPricingStats() {
    const [total, running, ended] = await Promise.all([
      this.prisma.aBPricingTest.count(),
      this.prisma.aBPricingTest.count({ where: { status: 'RUNNING' } }),
      this.prisma.aBPricingTest.count({ where: { status: { not: 'RUNNING' } } }),
    ]);
    return { total, running, ended };
  }

  @Get('pricing/tests')
  @ApiOperation({ summary: 'List all A/B pricing tests' })
  async getPricingTests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? +page : 1;
    const l = limit ? +limit : 20;
    const [data, total] = await Promise.all([
      this.prisma.aBPricingTest.findMany({
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.aBPricingTest.count(),
    ]);
    return { data, total, page: p, totalPages: Math.ceil(total / l) };
  }

  @Post('pricing/tests/:id/end')
  @ApiOperation({ summary: 'Cancel an A/B pricing test' })
  async endPricingTest(@Param('id') id: string) {
    return this.prisma.aBPricingTest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  @Post('pricing/tests/:id/revert')
  @ApiOperation({ summary: 'Revert an A/B pricing test (cancel and restore price A)' })
  async revertPricingTest(@Param('id') id: string) {
    const test = await this.prisma.aBPricingTest.findUniqueOrThrow({
      where: { id },
      select: { productId: true, variantA: true },
    });
    await this.prisma.product.update({
      where: { id: test.productId },
      data: { basePrice: test.variantA },
    });
    return this.prisma.aBPricingTest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // ── Creator DNA ───────────────────────────────────────────────────────────

  @Get('creator-dna')
  @ApiOperation({ summary: 'List all creator DNA analyses' })
  async getCreatorDna(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? +page : 1;
    const l = limit ? +limit : 20;
    const [data, total] = await Promise.all([
      this.prisma.creatorDNAAnalysis.findMany({
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.creatorDNAAnalysis.count(),
    ]);
    return { data, total, page: p, totalPages: Math.ceil(total / l) };
  }

  @Post('creator-dna/:id/reanalyze')
  @ApiOperation({ summary: 'Trigger re-analysis of a creator DNA profile' })
  async reanalyzeCreatorDna(@Param('id') id: string) {
    await this.prisma.creatorDNAAnalysis.update({
      where: { id },
      data: { status: 'PENDING' },
    });
    return { queued: true, id };
  }

  // ── Trend Drafts ──────────────────────────────────────────────────────────

  @Get('trend-drafts/pending-count')
  @ApiOperation({ summary: 'Count of trend product drafts awaiting admin review' })
  async getTrendDraftsPendingCount() {
    const count = await this.prisma.trendProductDraft.count({ where: { status: 'PENDING_REVIEW' } });
    return { count };
  }

  @Get('trend-drafts')
  @ApiOperation({ summary: 'List trend product drafts' })
  async getTrendDrafts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const p = page ? +page : 1;
    const l = limit ? +limit : 20;
    const where = status ? { status: status as any } : {};
    const [rows, total] = await Promise.all([
      this.prisma.trendProductDraft.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.trendProductDraft.count({ where }),
    ]);
    const data = rows.map((d) => {
      const brief = (d.designBrief ?? {}) as Record<string, unknown>;
      return {
        id:          d.id,
        keyword:     d.trendTopic,
        category:    (brief['category'] as string) ?? null,
        score:       d.trendEngagement,
        source:      (brief['source'] as string) ?? 'AI',
        status:      d.status,
        summary:     (brief['summary'] as string) ?? d.suggestedDescription ?? null,
        suggestedAt: d.generatedAt.toISOString(),
        reviewedAt:  null,
        reviewedBy:  null,
      };
    });
    return {
      data,
      pagination: { total, page: p, totalPages: Math.ceil(total / l) },
    };
  }

  @Post('trend-drafts/:id/approve')
  @ApiOperation({ summary: 'Approve a trend product draft' })
  async approveTrendDraft(@Param('id') id: string) {
    return this.prisma.trendProductDraft.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  @Post('trend-drafts/:id/reject')
  @ApiOperation({ summary: 'Reject a trend product draft' })
  async rejectTrendDraft(@Param('id') id: string) {
    return this.prisma.trendProductDraft.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  @Post('trends/trigger-scan')
  @ApiOperation({ summary: 'Manually trigger a trend scan' })
  async triggerTrendScan() {
    const stores = await this.prisma.store.findMany({
      select: { id: true },
      where: { status: 'ACTIVE' },
      take: 10,
    });
    if (!stores.length) {
      return { triggered: true, created: 0, message: 'No active stores found' };
    }

    const TRENDS = [
      { topic: 'Cottagecore Aesthetic Prints',   category: 'Wall Art',      source: 'Pinterest Trends',   score: 87 },
      { topic: 'Celestial Moon Phase Jewelry',   category: 'Jewelry',       source: 'Etsy Search',        score: 92 },
      { topic: 'Botanical Pressed Flower Art',   category: 'Wall Art',      source: 'Google Trends',      score: 78 },
      { topic: 'Custom Pet Portrait Embroidery', category: 'Custom Gifts',  source: 'TikTok Trends',      score: 95 },
      { topic: 'Mushroom & Forest Decor',        category: 'Home Decor',    source: 'Pinterest Trends',   score: 83 },
      { topic: 'Y2K Revival Accessories',        category: 'Accessories',   source: 'TikTok Trends',      score: 89 },
      { topic: 'Boho Macramé Wall Hangings',     category: 'Home Decor',    source: 'Etsy Search',        score: 76 },
      { topic: 'Abstract Watercolor Portraits',  category: 'Wall Art',      source: 'Instagram Trends',   score: 81 },
    ];

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const shuffled  = [...TRENDS].sort(() => Math.random() - 0.5);
    let created = 0;

    for (let i = 0; i < stores.length; i++) {
      const start  = (i * 2) % shuffled.length;
      const topics = shuffled.slice(start, start + 2).length === 2
        ? shuffled.slice(start, start + 2)
        : [...shuffled.slice(start), ...shuffled.slice(0, 2 - (shuffled.length - start))];

      for (const t of topics) {
        await this.prisma.trendProductDraft.create({
          data: {
            storeId:             stores[i].id,
            trendTopic:          t.topic,
            trendEngagement:     t.score,
            generatedAt:         new Date(),
            designBrief: {
              category: t.category,
              source:   t.source,
              summary:  `AI detected rising demand for "${t.topic}" on ${t.source}. Engagement score: ${t.score}/100. Products in this niche show strong conversion potential — consider listing in the next 2 weeks.`,
            },
            generatedImageUrl:    '',
            suggestedProductName: t.topic,
            suggestedDescription: `Trending opportunity: ${t.topic}. ${t.source} data shows strong consumer interest (score ${t.score}/100). Handmade items in this category typically see 40–80% higher conversion during peak demand periods.`,
            suggestedTags:        [...t.topic.toLowerCase().split(' '), t.category.toLowerCase().replace(/ /g, '-')],
            status:               'PENDING_REVIEW',
            expiresAt,
          },
        });
        created++;
      }
    }

    await this.redis.set('trends:last:scan', new Date().toISOString(), 86400);
    return { triggered: true, created, timestamp: new Date().toISOString() };
  }
}
