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
    const [data, total] = await Promise.all([
      this.prisma.trendProductDraft.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: { store: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.trendProductDraft.count({ where }),
    ]);
    return { data, total, page: p, totalPages: Math.ceil(total / l) };
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
    await this.redis.set('trends:manual:trigger', Date.now(), 3600);
    return { triggered: true, timestamp: new Date().toISOString() };
  }
}
