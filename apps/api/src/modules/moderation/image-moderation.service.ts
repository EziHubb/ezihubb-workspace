import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ModerationResult } from './dto/moderation-result.dto';

const MODEL = 'claude-haiku-4-5';

const IMAGE_SYSTEM = `You are an image moderation AI for EziHubb, a handmade goods marketplace.
Analyze this image and return ONLY a JSON object.

Check for:
- nudity_explicit: explicit sexual content
- nudity_partial: partial nudity (context matters — art vs pornography)
- violence_graphic: blood, gore, weapons being used
- hate_symbols: Nazi symbols, hate group imagery
- illegal_items: drugs, illegal weapons displayed
- csam: any sexualized content involving minors
- brand_counterfeit: fake luxury brands clearly displayed
- clean: appropriate for all audiences

Return ONLY this JSON:
{
  "verdict": "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "categories": ["category1"],
  "confidence": 0.0,
  "reasoning": "brief description for admin",
  "sellerMessage": "polite message if violation found, else null"
}`;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ImageModerationService {
  private readonly logger = new Logger(ImageModerationService.name);
  private readonly apiKey:  string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey  = this.config.get<string>('ANTHROPIC_API_KEY') ?? '';
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  async checkImage(imageUrl: string): Promise<ModerationResult> {
    const start = Date.now();

    try {
      // Download image
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
      if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);

      const buffer = await imgRes.arrayBuffer();
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        this.logger.warn(`Image too large (${buffer.byteLength} bytes), skipping: ${imageUrl}`);
        return this.cleanResult(Date.now() - start);
      }

      const contentType  = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const base64       = Buffer.from(buffer).toString('base64');

      const res = await fetch(this.baseUrl, {
        method:  'POST',
        headers: {
          'x-api-key':         this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: 300,
          system:     IMAGE_SYSTEM,
          messages: [{
            role:    'user',
            content: [{
              type:   'image',
              source: { type: 'base64', media_type: contentType, data: base64 },
            }],
          }],
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) throw new Error(`Claude API error ${res.status}`);

      const json: { content: { type: string; text: string }[] } = await res.json();
      const text   = json.content.find((c) => c.type === 'text')?.text ?? '';
      const parsed = JSON.parse(text) as ModerationResult;

      return { ...parsed, latencyMs: Date.now() - start, modelVersion: MODEL };
    } catch (err) {
      this.logger.error('Image moderation failed', err);
      return this.cleanResult(Date.now() - start);
    }
  }

  private cleanResult(latencyMs: number): ModerationResult {
    return { verdict: 'CLEAN', categories: [], confidence: 0, reasoning: null, sellerMessage: null, latencyMs, modelVersion: MODEL };
  }
}
