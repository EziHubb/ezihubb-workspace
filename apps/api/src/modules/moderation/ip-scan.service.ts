import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

export interface IPScanResult {
  verdict:        'SAFE' | 'WARNING' | 'BLOCKED';
  detectedBrands: string[];
  detectedIP:     string[];
  confidence:     number;
  reasoning:      string | null;
  cached:         boolean;
  latencyMs:      number;
}

const IP_SCAN_DAILY_KEY  = () => `ip-scan:daily:${new Date().toISOString().slice(0, 10)}`;
const IP_SCAN_CACHE_KEY  = (hash: string) => `ip-scan:safe:${hash}`;

// Common trademark blocklist (seed list — admin can extend via ModerationRule)
const TRADEMARK_BLOCKLIST = new Set([
  'nike', 'adidas', 'disney', 'marvel', 'dc comics', 'supreme', 'gucci', 'louis vuitton',
  'chanel', 'prada', 'balenciaga', 'rolex', 'apple', 'google', 'microsoft', 'coca-cola',
  'pepsi', 'mcdonalds', 'starbucks', 'nba', 'nfl', 'mlb', 'nhl', 'fifa',
  'harry potter', 'star wars', 'pokemon', 'hello kitty', 'mickey mouse',
  'ferrari', 'lamborghini', 'porsche', 'bmw', 'mercedes',
]);

@Injectable()
export class IPScanService {
  private readonly logger = new Logger(IPScanService.name);
  private readonly anthropicKey: string;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly redis:   RedisService,
    private readonly config:  ConfigService,
  ) {
    this.anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY') ?? '';
  }

  async scanDesignForIP(dto: {
    imageUrl:   string;
    entityType: string;
    entityId:   string;
    storeId?:   string;
  }): Promise<IPScanResult> {
    const start = Date.now();

    // 1. Check Redis cache
    const urlHash  = Buffer.from(dto.imageUrl).toString('base64').slice(0, 32);
    const cacheKey = IP_SCAN_CACHE_KEY(urlHash);
    const cached   = await this.redis.get<IPScanResult>(cacheKey);
    if (cached) return { ...cached, cached: true };

    // 2. Check daily budget (max 1000 scans/day)
    const dailyKey   = IP_SCAN_DAILY_KEY();
    const dailyRaw   = await this.redis.get<string>(dailyKey);
    const dailyCount = parseInt(dailyRaw ?? '0', 10);
    if (dailyCount >= 1000) {
      this.logger.warn('IP scan daily limit reached, failing open');
      return this.safeResult(Date.now() - start);
    }

    let result: IPScanResult;

    try {
      // 3. Download image
      const imgRes = await fetch(dto.imageUrl, { signal: AbortSignal.timeout(10_000) });
      if (!imgRes.ok) return this.safeResult(Date.now() - start);

      const buffer    = await imgRes.arrayBuffer();
      const base64    = Buffer.from(buffer).toString('base64');
      const mediaType = imgRes.headers.get('content-type') ?? 'image/jpeg';

      // 4. Ask Claude API with IP-specific prompt
      const claudeResult = await this.scanWithClaude(base64, mediaType);

      // 5. Check trademark blocklist merged with admin rules
      const trademarkRules = await this.getTrademarkRules();
      const allKnown = new Set([...TRADEMARK_BLOCKLIST, ...trademarkRules]);
      const detected = claudeResult.detectedBrands.filter(
        b => allKnown.has(b.toLowerCase()),
      );

      // 6. Determine verdict
      let verdict: 'SAFE' | 'WARNING' | 'BLOCKED' = 'SAFE';
      if (detected.length > 0 && claudeResult.confidence > 0.85) {
        verdict = 'BLOCKED';
      } else if (claudeResult.detectedBrands.length > 0 || claudeResult.possibleIP) {
        verdict = 'WARNING';
      }

      result = {
        verdict,
        detectedBrands: claudeResult.detectedBrands,
        detectedIP:     claudeResult.detectedIP,
        confidence:     claudeResult.confidence,
        reasoning:      claudeResult.reasoning,
        cached:         false,
        latencyMs:      Date.now() - start,
      };

      // 7. Save to ModerationLog (non-blocking)
      const dbVerdict  = verdict === 'BLOCKED' ? 'FLAGGED' : verdict === 'WARNING' ? 'FLAGGED' : 'CLEAN';
      const dbSeverity = verdict === 'BLOCKED' ? 'HIGH' : verdict === 'WARNING' ? 'MEDIUM' : 'CLEAN';
      this.prisma.moderationLog.create({
        data: {
          entityType:  dto.entityType,
          entityId:    dto.entityId,
          contentHash: urlHash,
          verdict:     dbVerdict as 'CLEAN' | 'FLAGGED',
          severity:    dbSeverity,
          categories:  claudeResult.detectedBrands,
          confidence:  claudeResult.confidence,
          reasoning:   claudeResult.reasoning ?? '',
          modelVersion: 'ip-scan-v1',
          provider:    'claude',
          latencyMs:   Date.now() - start,
          triggeredBy: 'ip-scan',
        },
      }).catch(() => {});

      // 8. Cache SAFE results for 7 days
      if (verdict === 'SAFE') {
        await this.redis.set(cacheKey, result, 7 * 24 * 60 * 60);
      }

      // Increment daily counter (expires after 24 h on first write)
      await this.redis.increment(dailyKey, 86400);

    } catch (err) {
      this.logger.error('IP scan failed', err);
      result = this.safeResult(Date.now() - start);
    }

    return result;
  }

  private async scanWithClaude(base64: string, mediaType: string): Promise<{
    detectedBrands: string[];
    detectedIP:     string[];
    possibleIP:     boolean;
    confidence:     number;
    reasoning:      string | null;
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
        max_tokens: 400,
        system: `You are an IP/trademark detection AI for a handmade goods marketplace.
Analyze this image and return ONLY valid JSON with these fields:
{
  "detectedBrands": ["brand names found, e.g. Nike, Disney"],
  "detectedIP": ["copyrighted characters, artworks, or licensed IP found"],
  "possibleIP": true or false,
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}
Flag: logos, brand names, licensed characters, celebrity faces, famous artworks.
Do NOT flag: generic designs, abstract art, custom illustrations, text without brand marks.`,
        messages: [{
          role:    'user',
          content: [{
            type:   'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          }],
        }],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) throw new Error(`Claude API error ${res.status}`);

    const json: { content: { type: string; text: string }[] } = await res.json();
    const text = json.content.find(c => c.type === 'text')?.text ?? '{}';
    return JSON.parse(text) as {
      detectedBrands: string[];
      detectedIP:     string[];
      possibleIP:     boolean;
      confidence:     number;
      reasoning:      string | null;
    };
  }

  private async getTrademarkRules(): Promise<string[]> {
    const rules = await this.prisma.moderationRule.findMany({
      where:  { ruleType: 'TRADEMARK', isActive: true },
      select: { value: true },
    });
    return rules.map(r => r.value.toLowerCase());
  }

  private safeResult(latencyMs: number): IPScanResult {
    return {
      verdict:        'SAFE',
      detectedBrands: [],
      detectedIP:     [],
      confidence:     0,
      reasoning:      null,
      cached:         false,
      latencyMs,
    };
  }
}
