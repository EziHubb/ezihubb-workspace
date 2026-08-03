import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ModerationResult } from './dto/moderation-result.dto';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are a content moderation AI for EziHubb, a handmade goods marketplace.
Analyze the following content and return ONLY a JSON object.

Violation categories to check:
- illegal_goods: drugs, weapons, counterfeit, stolen goods
- adult_content: explicit sexual content, pornography
- hate_speech: racism, discrimination, threats, harassment
- csam: any content involving minors sexually
- spam_misleading: false claims, spam, scam, phishing
- personal_info: sharing private contact details, attempting off-platform transactions
- violence: graphic violence, threats
- ip_violation: counterfeit brands, copyright infringement claims
- clean: no violations found

Severity levels:
- CRITICAL: illegal_goods, csam — immediate action required
- HIGH: adult_content, hate_speech, violence
- MEDIUM: spam_misleading, ip_violation
- LOW: personal_info

Return ONLY this JSON, no other text:
{
  "verdict": "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "categories": ["category1"],
  "confidence": 0.0,
  "reasoning": "brief explanation for admin (1-2 sentences)",
  "sellerMessage": "polite message to seller (if violation, else null)",
  "language": "en"
}`;

@Injectable()
export class TextModerationService {
  private readonly logger = new Logger(TextModerationService.name);
  private readonly apiKey:  string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey  = this.config.get<string>('ANTHROPIC_API_KEY') ?? '';
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  async checkText(content: string): Promise<ModerationResult> {
    const start = Date.now();

    try {
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
          system:     SYSTEM_PROMPT,
          messages:   [{ role: 'user', content }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`Claude API error ${res.status}`);
      }

      const json: { content: { type: string; text: string }[] } = await res.json();
      const text = json.content.find((c) => c.type === 'text')?.text ?? '';
      const parsed = JSON.parse(text) as ModerationResult;

      return {
        ...parsed,
        latencyMs:    Date.now() - start,
        modelVersion: MODEL,
      };
    } catch (err) {
      this.logger.error('Text moderation failed', err);
      // Fail open — return CLEAN on error
      return {
        verdict:       'CLEAN',
        categories:    [],
        confidence:    0,
        reasoning:     null,
        sellerMessage: null,
        latencyMs:     Date.now() - start,
        modelVersion:  MODEL,
      };
    }
  }
}
