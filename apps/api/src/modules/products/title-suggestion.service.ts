import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AnthropicService } from '../../common/services/anthropic.service';

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

  constructor(private readonly anthropic: AnthropicService) {}

  async suggest(name: string, description?: string, categoryName?: string): Promise<string> {
    if (!this.anthropic.isConfigured()) {
      throw new ServiceUnavailableException('Title suggestions are not configured on this server.');
    }

    const userContent = [
      `Current title: ${name}`,
      description  ? `Description: ${description.slice(0, 2000)}` : null,
      categoryName ? `Category: ${categoryName}`                  : null,
    ].filter(Boolean).join('\n');

    try {
      const parsed = await this.anthropic.json<{ title?: string }>({
        system:    SYSTEM_PROMPT,
        content:   userContent,
        maxTokens: 200,
        timeoutMs: 15_000,
      });

      const title = parsed.title?.trim();
      if (!title) throw new Error('Model returned no title');

      return title.slice(0, MAX_TITLE_LENGTH);
    } catch (err) {
      this.logger.error('Title suggestion failed', err);
      throw new ServiceUnavailableException('Could not generate a title suggestion right now — please try again.');
    }
  }
}
