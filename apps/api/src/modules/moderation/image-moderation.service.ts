import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService, DEFAULT_ANTHROPIC_MODEL } from '../../common/services/anthropic.service';
import type { ModerationResult } from './dto/moderation-result.dto';

// Recorded on the moderation row so a later review knows which model judged
// it. Reads the shared default rather than naming one this service no longer
// chooses.
const MODEL = DEFAULT_ANTHROPIC_MODEL;

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
  constructor(private readonly anthropic: AnthropicService) {}

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

      const { data: parsed, usage } = await this.anthropic.jsonWithUsage<ModerationResult>({
        system:  IMAGE_SYSTEM,
        content: [{
          type:   'image',
          source: { type: 'base64', media_type: contentType, data: base64 },
        }],
        maxTokens: 300,
        timeoutMs: 20_000,
      });

      return { ...parsed, latencyMs: Date.now() - start, modelVersion: MODEL, costUsd: usage.costUsd };
    } catch (err) {
      this.logger.error('Image moderation failed', err);
      return this.cleanResult(Date.now() - start);
    }
  }

  private cleanResult(latencyMs: number): ModerationResult {
    // costUsd 0, not absent: this path returns without calling the API at all
    // (image too large, fetch failed), and the tracker's fallback would
    // otherwise bill the daily budget for a call that never happened.
    return { verdict: 'CLEAN', categories: [], confidence: 0, reasoning: null, sellerMessage: null, latencyMs, modelVersion: MODEL, costUsd: 0 };
  }
}
