import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService, DEFAULT_ANTHROPIC_MODEL } from '../../common/services/anthropic.service';
import type { ModerationResult } from './dto/moderation-result.dto';

// Recorded on the moderation row so a later review knows which model judged
// it. Reads the shared default rather than naming a model this service no
// longer chooses.
const MODEL = DEFAULT_ANTHROPIC_MODEL;

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

  constructor(private readonly anthropic: AnthropicService) {}

  async checkText(content: string): Promise<ModerationResult> {
    const start = Date.now();

    try {
      const { data: parsed, usage } = await this.anthropic.jsonWithUsage<ModerationResult>({
        system:    SYSTEM_PROMPT,
        content,
        maxTokens: 300,
        timeoutMs: 15_000,
      });

      return {
        ...parsed,
        latencyMs:    Date.now() - start,
        modelVersion: MODEL,
        costUsd:      usage.costUsd,
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
        // The call failed, so nothing was consumed — charging the tracker's
        // fallback here would bill the budget for a call that produced nothing.
        costUsd:       0,
      };
    }
  }
}
