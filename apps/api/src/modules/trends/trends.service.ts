import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, AI_JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { TrendSourceRegistry, SourceSettings } from './source-registry.service';
import type { TrendTopic as RegistryTrendTopic } from './source-registry.service';

interface TrendTopic {
  hashtag:         string;
  description:     string;
  engagementScore: number;
  source?:         string;
}

@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);
  private readonly anthropicKey: string;
  private readonly replicateToken: string;
  private readonly TREND_CACHE_TTL = 3600; // 1h
  private readonly MAX_DRAFTS_PER_STORE_PER_DAY = 3;

  constructor(
    private readonly prisma:    PrismaService,
    private readonly redis:     RedisService,
    private readonly config:    ConfigService,
    private readonly registry:  TrendSourceRegistry,
    @InjectQueue(QUEUES.EMAIL)        private readonly emailQueue: Queue,
    @InjectQueue(QUEUES.AI_FEATURES)  private readonly aiQueue:   Queue,
  ) {
    this.anthropicKey   = this.config.get<string>('ANTHROPIC_API_KEY')   ?? '';
    this.replicateToken = this.config.get<string>('REPLICATE_API_TOKEN') ?? '';
  }

  // ── Load source settings (Redis cache → DB → defaults) ───────────────────

  private async getSourceSettings(): Promise<Record<string, SourceSettings>> {
    // Read from Redis cache (populated by AiStatsService when admin saves)
    const cached  = await this.redis.get<Record<string, unknown>>('admin:ai:settings');
    if (cached?.['trendSources']) {
      return { ...this.registry.getDefaultConfigs(), ...(cached['trendSources'] as Record<string, SourceSettings>) };
    }

    // Fallback: read directly from DB
    const row = await this.prisma.appSettings.findUnique({ where: { key: 'ai:settings' } });
    if (row?.value) {
      const stored = ((row.value as Record<string, unknown>)['trendSources'] ?? {}) as Record<string, SourceSettings>;
      return { ...this.registry.getDefaultConfigs(), ...stored };
    }

    return this.registry.getDefaultConfigs();
  }

  // ── Get trending topics ────────────────────────────────────────────────────

  async getTrendingTopics(sourceFilter?: string[]): Promise<TrendTopic[]> {
    const cacheKey = sourceFilter?.length
      ? `trends:multi:${sourceFilter.sort().join('+')}`
      : 'trends:multi:default';

    const cached = await this.redis.get(cacheKey) as TrendTopic[] | null;
    if (cached) return cached;

    const sourceConfigs = await this.getSourceSettings();
    const topics        = await this.registry.fetchFromSources(sourceConfigs, sourceFilter, 15);

    if (topics.length > 0) {
      await this.redis.set(cacheKey, topics, this.TREND_CACHE_TTL);
      return topics;
    }

    return [];
  }

  // ── Generate design brief (GPT-4o / Claude) ───────────────────────────────

  private async generateDesignBrief(trend: TrendTopic): Promise<{
    productType:    string;
    designConcept:  string;
    textContent:    string;
    colorPalette:   string;
    style:          string;
    targetAudience: string;
  }> {
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
        messages: [{
          role: 'user',
          content: `You are a POD product designer. Create a design brief for this trending topic: #${trend.hashtag} — ${trend.description}
Return ONLY valid JSON:
{
  "productType": "mug|t-shirt|tote-bag|poster|phone-case",
  "designConcept": "brief description",
  "textContent": "catchy quote or phrase for the design (max 10 words)",
  "colorPalette": "e.g. coral and white, navy and gold",
  "style": "minimalist|bold|humorous|vintage|modern",
  "targetAudience": "description of ideal buyer"
}`,
        }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error('Claude API failed');
    const json: { content: { type: string; text: string }[] } = await res.json();
    const text = json.content.find(c => c.type === 'text')?.text ?? '{}';
    return JSON.parse(text);
  }

  // ── Generate image (Replicate) ────────────────────────────────────────────

  private async generateDesignImage(brief: { designConcept: string; colorPalette: string; style: string; textContent: string }): Promise<string | null> {
    if (!this.replicateToken) return null;

    const prompt = `${brief.style} design, "${brief.textContent}", ${brief.designConcept}, ${brief.colorPalette} color palette, print-on-demand, transparent background, high quality vector art`;

    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method:  'POST',
      headers: {
        'Authorization': `Token ${this.replicateToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        version: 'ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4',
        input:   { prompt, width: 1024, height: 1024, num_outputs: 1 },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;
    const prediction = await res.json();

    // Poll for result
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${this.replicateToken}` },
      });
      const result = await pollRes.json();
      if (result.status === 'succeeded') return result.output?.[0] ?? null;
      if (result.status === 'failed') return null;
    }
    return null;
  }

  // ── Create trend draft ────────────────────────────────────────────────────

  async generateTrendDraftsForStore(storeId: string): Promise<void> {
    // Rate limit: max 3 drafts per store per day
    const dailyKey  = `trends:drafts:${storeId}:${new Date().toISOString().slice(0, 10)}`;
    const dailyCount = parseInt(await this.redis.get(dailyKey) as string ?? '0', 10);
    if (dailyCount >= this.MAX_DRAFTS_PER_STORE_PER_DAY) return;

    const trends = await this.getTrendingTopics();
    const topTrends = trends.slice(0, 3);

    for (const trend of topTrends) {
      try {
        const brief = await this.generateDesignBrief(trend);
        const imageUrl = await this.generateDesignImage(brief) ?? '';

        await this.prisma.trendProductDraft.create({
          data: {
            storeId,
            trendTopic:          `#${trend.hashtag}`,
            trendEngagement:     trend.engagementScore,
            designBrief:         brief,
            generatedImageUrl:   imageUrl,
            suggestedProductName: `${brief.textContent} ${brief.productType}`,
            suggestedDescription: `${brief.designConcept}. Perfect for ${brief.targetAudience}.`,
            suggestedTags:        [trend.hashtag, brief.style, brief.productType],
            expiresAt:            new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        await this.redis.increment(dailyKey, 86400);
      } catch (err) {
        this.logger.error(`Failed to generate trend draft for store ${storeId}`, err);
      }
    }
  }

  // ── Get drafts for store ──────────────────────────────────────────────────

  async getDrafts(storeId: string) {
    return this.prisma.trendProductDraft.findMany({
      where:   { storeId, status: 'PENDING_REVIEW', expiresAt: { gt: new Date() } },
      orderBy: { trendEngagement: 'desc' },
    });
  }

  // ── Approve draft → create product ───────────────────────────────────────

  async approveDraft(storeId: string, draftId: string): Promise<{ productSlug: string }> {
    const draft = await this.prisma.trendProductDraft.findFirst({
      where: { id: draftId, storeId, status: 'PENDING_REVIEW', expiresAt: { gt: new Date() } },
      include: { store: { select: { id: true } } },
    });
    if (!draft) throw new Error('Draft not found or expired');

    // Find default category
    const category = await this.prisma.category.findFirst({ select: { id: true } });

    const slug = draft.suggestedProductName
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
      + '-' + Date.now().toString(36);

    // Upsert tags first to get their IDs
    const tagIds: string[] = [];
    for (const t of draft.suggestedTags) {
      const tagSlug = t.toLowerCase().replace(/\s+/g, '-');
      const tag = await this.prisma.tag.upsert({
        where:  { slug: tagSlug },
        create: { name: t, slug: tagSlug },
        update: {},
      });
      tagIds.push(tag.id);
    }

    const product = await this.prisma.product.create({
      data: {
        name:          draft.suggestedProductName,
        slug,
        sku:           `TREND-${Date.now().toString(36).toUpperCase()}`,
        description:   draft.suggestedDescription,
        basePrice:     19.99,
        categoryId:    category?.id ?? '',
        storeId,
        status:        'ACTIVE',
        tags: {
          create: tagIds.map(tagId => ({ tagId })),
        },
      },
    });

    if (draft.generatedImageUrl) {
      await this.prisma.productImage.create({
        data: { productId: product.id, url: draft.generatedImageUrl, isPrimary: true },
      });
    }

    await this.prisma.trendProductDraft.update({
      where: { id: draftId },
      data:  { status: 'APPROVED', approvedProductId: product.id },
    });

    return { productSlug: slug };
  }

  async rejectDraft(storeId: string, draftId: string): Promise<void> {
    await this.prisma.trendProductDraft.updateMany({
      where: { id: draftId, storeId },
      data:  { status: 'REJECTED' },
    });
  }

  // ── Daily cron: generate for all stores ──────────────────────────────────

  async runDailyTrendGeneration(): Promise<void> {
    const stores = await this.prisma.store.findMany({
      where:  { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const store of stores) {
      await this.generateTrendDraftsForStore(store.id).catch((err: Error) => this.logger.warn(`Trend generation failed for store ${store.id}: ${err.message}`));
    }
  }

  // ── Admin methods ─────────────────────────────────────────────────────────

  async getPendingCount(): Promise<{ count: number }> {
    const count = await this.prisma.trendProductDraft.count({
      where: { status: 'PENDING_REVIEW' },
    });
    return { count };
  }

  async listDrafts(page = 1, limit = 20, status?: string) {
    const where = status ? { status: status as any } : {};
    const [rows, total] = await Promise.all([
      this.prisma.trendProductDraft.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: { store: { select: { id: true, name: true } } },
      }),
      this.prisma.trendProductDraft.count({ where }),
    ]);
    const data = rows.map((d) => {
      const brief = (d.designBrief ?? {}) as Record<string, unknown>;
      return {
        id:               d.id,
        storeId:          d.storeId,
        storeName:        (d as any).store?.name ?? null,
        keyword:          d.trendTopic,
        // brief fields — correct keys from generateDesignBrief output
        category:         (brief['productType']    as string) ?? null,
        score:            d.trendEngagement,
        source:           d.trendPlatform ?? 'TikTok',
        status:           d.status,
        summary:          (brief['designConcept']  as string) ?? d.suggestedDescription ?? null,
        textContent:      (brief['textContent']    as string) ?? null,
        colorPalette:     (brief['colorPalette']   as string) ?? null,
        style:            (brief['style']          as string) ?? null,
        targetAudience:   (brief['targetAudience'] as string) ?? null,
        imageUrl:         d.generatedImageUrl || null,
        productName:      d.suggestedProductName,
        approvedProductId: d.approvedProductId ?? null,
        suggestedAt:      d.generatedAt.toISOString(),
        reviewedAt:       null as string | null,
        reviewedBy:       null as string | null,
      };
    });
    return { data, pagination: { total, page, totalPages: Math.ceil(total / limit) } };
  }

  // ── Admin direct scan — runs synchronously, skips image generation ─────────

  async triggerAdminDirectScan(sourceIds?: string[]): Promise<{ created: number; stores: number; message: string; sources: string[] }> {
    // Pre-check: ensure at least one source is configured before hitting external APIs
    const sourceConfigs = await this.getSourceSettings();
    const idsToCheck = sourceIds?.length
      ? sourceIds
      : Object.entries(sourceConfigs).filter(([, c]) => c.enabled).map(([id]) => id);

    const anyConfigured = idsToCheck.some((id) => {
      const src = this.registry.getSource(id);
      if (!src) return false;
      return src.isConfigured({ apiKey: sourceConfigs[id]?.apiKey ?? undefined });
    });

    if (!anyConfigured) {
      return {
        created: 0,
        stores:  0,
        message: 'No trend sources are configured — set API keys in AI Settings before scanning',
        sources: [],
      };
    }

    const stores = await this.prisma.store.findMany({
      where:  { status: 'ACTIVE' },
      select: { id: true },
    });

    if (stores.length === 0) {
      return { created: 0, stores: 0, message: 'No active stores found — activate a store first', sources: [] };
    }

    const topics      = await this.getTrendingTopics(sourceIds);

    if (topics.length === 0) {
      return { created: 0, stores: stores.length, message: 'No trends returned from configured sources — check source API keys or try again later', sources: [] };
    }

    const topTopics   = topics.slice(0, 3);
    const usedSources = [...new Set(topTopics.map(t => (t as any).source ?? 'unknown'))];
    let created = 0;

    for (const store of stores) {
      for (const topic of topTopics) {
        try {
          let brief: Record<string, string>;

          if (this.anthropicKey) {
            brief = await this.generateDesignBrief(topic);
          } else {
            brief = {
              productType:    'mug',
              designConcept:  `Print-on-demand design inspired by #${topic.hashtag}`,
              textContent:    `#${topic.hashtag}`,
              colorPalette:   'navy and white',
              style:          'modern',
              targetAudience: 'social media enthusiasts',
            };
          }

          await this.prisma.trendProductDraft.create({
            data: {
              storeId:              store.id,
              trendTopic:           `#${topic.hashtag}`,
              trendEngagement:      topic.engagementScore,
              trendPlatform:        (topic as any).source ?? 'unknown',
              designBrief:          brief as any,
              generatedImageUrl:    '',
              suggestedProductName: `${brief['textContent']} ${brief['productType']}`,
              suggestedDescription: `${brief['designConcept']}. Perfect for ${brief['targetAudience']}.`,
              suggestedTags:        [topic.hashtag, brief['style'] ?? 'modern', brief['productType'] ?? 'mug'],
              expiresAt:            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          created++;
        } catch (err) {
          this.logger.error(`Direct scan failed for store ${store.id}, topic ${topic.hashtag}`, err);
        }
      }
    }

    const message = created > 0
      ? `${created} draft${created > 1 ? 's' : ''} created across ${stores.length} store${stores.length > 1 ? 's' : ''} from: ${usedSources.join(', ')}`
      : 'No drafts created — check API logs or configure at least one trend source';

    return { created, stores: stores.length, message, sources: usedSources };
  }

  async queueManualScan(): Promise<{ queued: boolean; jobId: string; triggered: boolean; created: number; message: string }> {
    const job = await this.aiQueue.add(
      AI_JOBS.FETCH_TRENDS,
      {},
      DEFAULT_JOB_OPTIONS,
    );
    await this.redis.set('trends:last:scan:queued', new Date().toISOString(), 86400);
    return {
      queued:    true,
      jobId:     String(job.id),
      triggered: true,
      created:   0,
      message:   'Trend scan queued — drafts will appear shortly',
    };
  }

  async adminApproveDraft(id: string) {
    return this.prisma.trendProductDraft.update({
      where: { id },
      data:  { status: 'APPROVED' },
    });
  }

  async adminRejectDraft(id: string) {
    return this.prisma.trendProductDraft.update({
      where: { id },
      data:  { status: 'REJECTED' },
    });
  }

  async adminCreateProductFromDraft(draftId: string): Promise<{ productSlug: string }> {
    const draft = await this.prisma.trendProductDraft.findUnique({ where: { id: draftId } });
    if (!draft) throw new Error('Draft not found');
    return this.approveDraft(draft.storeId, draftId);
  }

  async expireOldDrafts(): Promise<{ expired: number }> {
    const result = await this.prisma.trendProductDraft.updateMany({
      where: { status: 'PENDING_REVIEW', expiresAt: { lte: new Date() } },
      data:  { status: 'EXPIRED' },
    });
    return { expired: result.count };
  }
}
