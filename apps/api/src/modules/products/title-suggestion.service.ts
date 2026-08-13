import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Same model/call pattern as TextModerationService — raw fetch to the Anthropic
// Messages API rather than an SDK, since that's the only LLM integration this
// codebase already has wired up (see apps/api/src/modules/moderation/text-moderation.service.ts).
const MODEL = 'claude-haiku-4-5';
const MAX_TITLE_LENGTH = 140;

const SYSTEM_PROMPT = `You are an SEO copywriter for EziHubb, a handmade/print-on-demand goods marketplace.
Rewrite the seller's listing title to help buyers find it in search, based on the title, description, and category given.

Rules:
- ${MAX_TITLE_LENGTH} characters or fewer
- Lead with the most important keyword(s) a buyer would actually search for
- Where it fits naturally, include what it is, who it's for, and what makes it special
- Stay truthful to the provided title/description — never invent materials, features, or claims not present in them
- No ALL CAPS, no excessive punctuation or emoji spam
- Return ONLY this JSON object, no other text: { "title": "..." }`;

@Injectable()
export class TitleSuggestionService {
  private readonly logger = new Logger(TitleSuggestionService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.anthropic.com/v1/messages';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY') ?? '';
  }

  async suggest(name: string, description?: string, categoryName?: string): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('Title suggestions are not configured on this server.');
    }

    const userContent = [
      `Current title: ${name}`,
      description   ? `Description: ${description.slice(0, 2000)}` : null,
      categoryName   ? `Category: ${categoryName}`                  : null,
    ].filter(Boolean).join('\n');

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
          max_tokens: 200,
          system:     SYSTEM_PROMPT,
          messages:   [{ role: 'user', content: userContent }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`Claude API error ${res.status}`);
      }

      const json: { content: { type: string; text: string }[] } = await res.json();
      const text = json.content.find((c) => c.type === 'text')?.text ?? '';
      const parsed = JSON.parse(text) as { title?: string };

      const title = parsed.title?.trim();
      if (!title) throw new Error('Empty suggestion from model');

      return title.slice(0, MAX_TITLE_LENGTH);
    } catch (err) {
      this.logger.error('Title suggestion failed', err);
      throw new ServiceUnavailableException('Could not generate a title suggestion right now — please try again.');
    }
  }
}
