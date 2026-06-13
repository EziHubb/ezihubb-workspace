import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

@Injectable()
export class AiStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  async getOverallStats() {
    const [pricingTests, trendDrafts, dnaAnalyses, pendingDrafts, runningTests] = await Promise.all([
      this.prisma.aBPricingTest.count(),
      this.prisma.trendProductDraft.count(),
      this.prisma.creatorDNAAnalysis.count(),
      this.prisma.trendProductDraft.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.aBPricingTest.count({ where: { status: 'RUNNING' } }),
    ]);
    return { pricingTests, trendDrafts, dnaAnalyses, pendingDrafts, runningTests };
  }

  async getUsageMetrics(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [trendDraftCalls, pricingCalls, dnaCalls] = await Promise.all([
      this.prisma.trendProductDraft.count({ where: { createdAt: { gte: since } } }),
      this.prisma.aBPricingTest.count({ where: { createdAt: { gte: since } } }),
      this.prisma.creatorDNAAnalysis.count({ where: { createdAt: { gte: since } } }),
    ]);
    const totalCalls = trendDraftCalls + pricingCalls + dnaCalls;
    return {
      days,
      since:               since.toISOString(),
      totalCalls,
      trendDraftCalls,
      pricingAnalysisCalls: pricingCalls,
      dnaAnalysisCalls:    dnaCalls,
      estimatedCostUsd:    (totalCalls * 0.002).toFixed(4),
    };
  }

  async getSettings() {
    const cached = await this.redis.get<Record<string, unknown>>('admin:ai:settings');
    if (cached) return cached;
    return {
      pricingEnabled:   true,
      trendsEnabled:    true,
      creatorDnaEnabled: true,
      maxDailyApiCalls: 1000,
      autoApproveDrafts: false,
    };
  }

  async updateSettings(settings: Record<string, unknown>) {
    await this.redis.set('admin:ai:settings', settings, 86400);
    return settings;
  }
}
