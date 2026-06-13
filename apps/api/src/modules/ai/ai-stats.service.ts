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

  private readonly SETTINGS_KEY  = 'ai:settings';
  private readonly CACHE_KEY     = 'admin:ai:settings';
  private readonly CACHE_TTL     = 3600; // 1h read cache; source of truth is DB

  private getDefaults(): Record<string, unknown> {
    return {
      pricingEnabled:         true,
      trendsEnabled:          true,
      creatorDnaEnabled:      true,
      maxDailyApiCalls:       1000,
      autoApproveDrafts:      false,
      trendScanIntervalHours: 24,
      trendMinScore:          0,
      pricingMaxVariantPct:   20,
      pricingAutoApprove:     false,
      creatorDnaAutoRun:      false,
      replicateEnabled:       false,
      replicateModel:         'ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4',
      monthlyCostLimitUsd:    100,
      dailyCallLimit:         500,
      trendSources: {
        google:    { enabled: true,  apiKey: '', geo: 'US' },
        reddit:    { enabled: true,  apiKey: '', geo: '' },
        amazon:    { enabled: true,  apiKey: '', geo: '' },
        tiktok:    { enabled: false, apiKey: '', geo: '' },
        shopee:    { enabled: false, apiKey: '', geo: 'VN' },
        taobao:    { enabled: false, apiKey: '', geo: '' },
        pinterest: { enabled: false, apiKey: '', geo: 'US' },
      },
    };
  }

  async getSettings(): Promise<Record<string, unknown>> {
    // 1. Redis read cache (fast path)
    const cached = await this.redis.get<Record<string, unknown>>(this.CACHE_KEY);
    if (cached) return cached;

    // 2. Persistent store — PostgreSQL via AppSettings
    const row = await this.prisma.appSettings.findUnique({ where: { key: this.SETTINGS_KEY } });
    if (row?.value) {
      const settings = row.value as Record<string, unknown>;
      await this.redis.set(this.CACHE_KEY, settings, this.CACHE_TTL);
      return settings;
    }

    // 3. First run — return defaults (not persisted yet)
    return this.getDefaults();
  }

  async updateSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Merge with existing to avoid overwriting keys not sent in this request
    const existing = await this.getSettings();
    const merged   = this.deepMerge(existing, settings);

    // Persist to DB
    await this.prisma.appSettings.upsert({
      where:  { key: this.SETTINGS_KEY },
      create: { key: this.SETTINGS_KEY, value: merged as any },
      update: { value: merged as any },
    });

    // Refresh cache
    await this.redis.set(this.CACHE_KEY, merged, this.CACHE_TTL);

    return merged;
  }

  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target };
    for (const [k, v] of Object.entries(source)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v) &&
          typeof result[k] === 'object' && result[k] !== null && !Array.isArray(result[k])) {
        result[k] = this.deepMerge(result[k] as Record<string, unknown>, v as Record<string, unknown>);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
}
