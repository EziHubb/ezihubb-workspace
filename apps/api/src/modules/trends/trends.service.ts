import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '../../queue/queue.constants';

interface TrendTopic {
  hashtag:         string;
  description:     string;
  engagementScore: number;
}

@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);
  private readonly anthropicKey: string;
  private readonly replicateToken: string;
  private readonly rapidApiKey: string;
  private readonly TREND_CACHE_TTL = 3600; // 1h
  private readonly MAX_DRAFTS_PER_STORE_PER_DAY = 3;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly redis:   RedisService,
    private readonly config:  ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {
    this.anthropicKey   = this.config.get<string>('ANTHROPIC_API_KEY')    ?? '';
    this.replicateToken = this.config.get<string>('REPLICATE_API_TOKEN')  ?? '';
    this.rapidApiKey    = this.config.get<string>('RAPIDAPI_TIKTOK_KEY')  ?? '';
  }

  // ── Get trending topics ────────────────────────────────────────────────────

  async getTrendingTopics(): Promise<TrendTopic[]> {
    const cacheKey = 'trends:tiktok:latest';
    const cached = await this.redis.get(cacheKey) as TrendTopic[] | null;
    if (cached) return cached;

    // If no RapidAPI key, return mock trends for development
    if (!this.rapidApiKey) {
      return this.getMockTrends();
    }

    try {
      const res = await fetch(
        'https://tiktok-api6.p.rapidapi.com/hashtags/trending',
        {
          headers: {
            'X-RapidAPI-Key':  this.rapidApiKey,
            'X-RapidAPI-Host': 'tiktok-api6.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) return this.getMockTrends();

      const data: any = await res.json();
      const trends: TrendTopic[] = (data.data ?? []).slice(0, 20).map((t: any) => ({
        hashtag:         t.name ?? t.hashtag_name,
        description:     t.description ?? `Trending: #${t.name}`,
        engagementScore: t.video_views ?? t.engagement ?? 0,
      }));

      await this.redis.set(cacheKey, trends, this.TREND_CACHE_TTL);
      return trends;
    } catch {
      return this.getMockTrends();
    }
  }

  private getMockTrends(): TrendTopic[] {
    return [
      { hashtag: 'nursehumor',     description: 'Nursing and healthcare humor content', engagementScore: 2_400_000 },
      { hashtag: 'teacherlife',    description: 'Teachers sharing classroom moments',   engagementScore: 1_800_000 },
      { hashtag: 'coffeelovers',   description: 'Coffee culture and morning routines',  engagementScore: 3_200_000 },
      { hashtag: 'dogmom',         description: 'Dog owner lifestyle content',          engagementScore: 2_100_000 },
      { hashtag: 'bookworm',       description: 'Reading and book club culture',        engagementScore: 1_500_000 },
    ];
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
}
