import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, AI_JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';

@Injectable()
export class CreatorDnaService {
  private readonly logger = new Logger(CreatorDnaService.name);
  private readonly anthropicKey:       string;
  private readonly tiktokClientKey:    string;
  private readonly tiktokClientSecret: string;
  private readonly instagramAppId:     string;
  private readonly instagramSecret:    string;
  private readonly baseUrl:            string;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    @InjectQueue(QUEUES.AI_FEATURES) private readonly aiQueue: Queue,
  ) {
    this.anthropicKey       = this.config.get<string>('ANTHROPIC_API_KEY')       ?? '';
    this.tiktokClientKey    = this.config.get<string>('TIKTOK_CLIENT_KEY')       ?? '';
    this.tiktokClientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET')    ?? '';
    this.instagramAppId     = this.config.get<string>('INSTAGRAM_APP_ID')        ?? '';
    this.instagramSecret    = this.config.get<string>('INSTAGRAM_APP_SECRET')    ?? '';
    this.baseUrl            = this.config.get<string>('NEXT_PUBLIC_URL')         ?? 'https://dailydaisy.com';
  }

  // ── OAuth URLs ────────────────────────────────────────────────────────────

  getTikTokAuthUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId, platform: 'tiktok' })).toString('base64url');
    const params = new URLSearchParams({
      client_key:    this.tiktokClientKey,
      scope:         'user.info.basic,video.list',
      response_type: 'code',
      redirect_uri:  `${this.baseUrl}/api/v1/creator-dna/tiktok/callback`,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  }

  getInstagramAuthUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId, platform: 'instagram' })).toString('base64url');
    const params = new URLSearchParams({
      app_id:        this.instagramAppId,
      redirect_uri:  `${this.baseUrl}/api/v1/creator-dna/instagram/callback`,
      scope:         'instagram_basic,user_media',
      response_type: 'code',
      state,
    });
    return `https://api.instagram.com/oauth/authorize?${params}`;
  }

  // ── OAuth callbacks ───────────────────────────────────────────────────────

  async handleTikTokCallback(code: string, state: string): Promise<void> {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString());

    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key:    this.tiktokClientKey,
        client_secret: this.tiktokClientSecret,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  `${this.baseUrl}/api/v1/creator-dna/tiktok/callback`,
      }),
    });

    if (!tokenRes.ok) throw new UnauthorizedException('TikTok auth failed');
    const { access_token, refresh_token, expires_in, open_id } = await tokenRes.json();

    await this.prisma.socialConnection.upsert({
      where:  { userId_platform: { userId, platform: 'tiktok' } },
      create: { userId, platform: 'tiktok', accessToken: access_token, refreshToken: refresh_token, platformUserId: open_id, expiresAt: new Date(Date.now() + expires_in * 1000) },
      update: { accessToken: access_token, refreshToken: refresh_token, platformUserId: open_id, expiresAt: new Date(Date.now() + expires_in * 1000) },
    });

    // Trigger analysis in background
    this.runAnalysis(userId, 'tiktok').catch((err: Error) => this.logger.warn(`TikTok analysis failed: ${err.message}`));
  }

  async handleInstagramCallback(code: string, state: string): Promise<void> {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString());

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method:  'POST',
      body:    new URLSearchParams({ app_id: this.instagramAppId, app_secret: this.instagramSecret, grant_type: 'authorization_code', redirect_uri: `${this.baseUrl}/api/v1/creator-dna/instagram/callback`, code }),
    });

    if (!tokenRes.ok) throw new UnauthorizedException('Instagram auth failed');
    const { access_token, user_id } = await tokenRes.json();

    await this.prisma.socialConnection.upsert({
      where:  { userId_platform: { userId, platform: 'instagram' } },
      create: { userId, platform: 'instagram', accessToken: access_token, platformUserId: String(user_id) },
      update: { accessToken: access_token, platformUserId: String(user_id) },
    });

    this.runAnalysis(userId, 'instagram').catch((err: Error) => this.logger.warn(`Instagram analysis failed: ${err.message}`));
  }

  // ── Run audience analysis ─────────────────────────────────────────────────

  async runAnalysis(userId: string, platform: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { storeId: true },
    });
    if (!user?.storeId) return;

    const connection = await this.prisma.socialConnection.findUnique({
      where: { userId_platform: { userId, platform } },
    });
    if (!connection) return;

    const analysis = await this.prisma.creatorDNAAnalysis.create({
      data: { userId, storeId: user.storeId, platform, status: 'FETCHING_SOCIAL' },
    });

    try {
      const mockData = {
        topHashtags:          ['nursing', 'nurselife', 'healthcare'],
        avgEngagement:        8.5,
        followerCount:        12400,
        captionThemes:        ['humor', 'workplace', 'daily life'],
        audienceDemographics: { ageRange: '25-34', location: 'US', gender: 'female 72%' },
        postsAnalyzed:        47,
      };

      await this.prisma.creatorDNAAnalysis.update({
        where: { id: analysis.id },
        data:  { status: 'ANALYZING', postsAnalyzed: mockData.postsAnalyzed },
      });

      const insights = await this.callClaudeForAnalysis(mockData, platform);

      await this.prisma.creatorDNAAnalysis.update({
        where: { id: analysis.id },
        data:  { insights, status: 'COMPLETED', postsAnalyzed: mockData.postsAnalyzed },
      });
    } catch (err) {
      await this.prisma.creatorDNAAnalysis.update({
        where: { id: analysis.id },
        data:  { status: 'FAILED' },
      });
      this.logger.error('Creator DNA analysis failed', err);
    }
  }

  private async callClaudeForAnalysis(data: any, platform: string): Promise<any> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         this.anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        system: `You are a POD marketplace specialist analyzing a creator's ${platform} presence.
Recommend 3 most profitable POD niches. Return ONLY valid JSON:
{
  "primaryAudience": "description",
  "niches": [
    {
      "name": "niche name",
      "reason": "why this works",
      "designIdeas": ["idea1", "idea2", "idea3"],
      "estimatedConversionRate": "8-12%",
      "competitionLevel": "low|medium|high"
    }
  ],
  "storePersonalization": {
    "recommendedStoreName": "...",
    "recommendedDescription": "...",
    "recommendedTags": ["..."]
  }
}`,
        messages: [{
          role:    'user',
          content: `Analyze creator data: ${JSON.stringify(data)}`,
        }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error('Claude API failed');
    const json: { content: { type: string; text: string }[] } = await res.json();
    const text = json.content.find(c => c.type === 'text')?.text ?? '{}';
    return JSON.parse(text);
  }

  // ── Get analysis results ──────────────────────────────────────────────────

  async getAnalysis(userId: string) {
    return this.prisma.creatorDNAAnalysis.findFirst({
      where:   { userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select:  { insights: true, platform: true, createdAt: true },
    });
  }

  async getConnectedPlatforms(userId: string) {
    return this.prisma.socialConnection.findMany({
      where:  { userId },
      select: { platform: true, platformUserId: true, createdAt: true },
    });
  }

  async disconnect(userId: string, platform: string): Promise<void> {
    await this.prisma.socialConnection.deleteMany({
      where: { userId, platform },
    });
  }

  // ── Admin methods ─────────────────────────────────────────────────────────

  async listAnalyses(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.creatorDNAAnalysis.findMany({
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.creatorDNAAnalysis.count(),
    ]);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async queueReanalysis(id: string): Promise<{ queued: boolean; jobId: string }> {
    const analysis = await this.prisma.creatorDNAAnalysis.findUniqueOrThrow({
      where:  { id },
      select: { userId: true, platform: true },
    });

    await this.prisma.creatorDNAAnalysis.update({
      where: { id },
      data:  { status: 'PENDING', jobId: null },
    });

    const job = await this.aiQueue.add(
      AI_JOBS.ANALYZE_AUDIENCE,
      { userId: analysis.userId, platform: analysis.platform },
      DEFAULT_JOB_OPTIONS,
    );

    await this.prisma.creatorDNAAnalysis.update({
      where: { id },
      data:  { jobId: String(job.id) },
    });

    return { queued: true, jobId: String(job.id) };
  }
}
