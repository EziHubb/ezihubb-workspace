import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Same model/call pattern as TextModerationService — raw fetch to the Anthropic
// Messages API rather than an SDK, since that's the only LLM integration this
// codebase already has wired up (see apps/api/src/modules/moderation/text-moderation.service.ts).
// Sonnet rather than Opus: this writes one line of ~140 characters from a
// title and a description. Opus costs roughly 5× as much per token for a task
// with no long reasoning in it, and the extra latency is felt directly — the
// seller is sitting on the field waiting for the suggestion.
//
// Overridable because the endpoint may be an Anthropic-compatible gateway that
// publishes its own model names.
const DEFAULT_MODEL = 'claude-sonnet-4-6';
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

/**
 * Pulls the title out of whatever the model actually returned.
 *
 * The prompt asks for bare JSON, but "return only JSON" is a request, not a
 * guarantee — models routinely wrap it in a ```json fence, and a gateway may
 * route to a model that does so more often than the one this was written
 * against. Parsing the raw string alone turned that into a 503 for the seller.
 *
 * Falls back to the first JSON object found anywhere in the text, and finally
 * to a single-line response, so a formatting habit does not read as an outage.
 */
function extractTitle(raw: string): string {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const candidates = [text, text.match(/\{[\s\S]*\}/)?.[0]].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { title?: unknown };
      if (typeof parsed.title === 'string' && parsed.title.trim()) return parsed.title.trim();
    } catch {
      // Not JSON — try the next shape.
    }
  }

  // A plain one-liner is still a usable answer; anything longer is prose the
  // model wrote around a refusal, which is not.
  return !text.includes('\n') && text.length > 0 && text.length <= 200 ? text : '';
}

@Injectable()
export class TitleSuggestionService {
  private readonly logger = new Logger(TitleSuggestionService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY') ?? '';
    this.model  = this.config.get<string>('ANTHROPIC_MODEL') ?? DEFAULT_MODEL;

    // ANTHROPIC_BASE_URL names the API ROOT ("https://example.com"), not the
    // messages path, so a gateway can be swapped in without every caller
    // knowing the route. Trailing slashes are trimmed because an env value
    // copied from a browser address bar usually has one, and "…com//v1/…"
    // 404s on some gateways.
    const root = (this.config.get<string>('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com').replace(/\/+$/, '');
    this.baseUrl = `${root}/v1/messages`;
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
          // Some Anthropic-compatible gateways read the bearer header instead
          // of x-api-key. Sending both costs nothing and works with either.
          'authorization':     `Bearer ${this.apiKey}`,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      this.model,
          max_tokens: 200,
          system:     SYSTEM_PROMPT,
          messages:   [{ role: 'user', content: userContent }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        // The body is where a gateway says WHICH thing is wrong — unknown
        // model, bad key, no credit. Without it every failure looks the same
        // in the log and the next person re-derives it from scratch.
        const detail = await res.text().catch(() => '');
        throw new Error(`Claude API error ${res.status}: ${detail.slice(0, 300)}`);
      }

      const json: { content?: { type: string; text: string }[] } = await res.json();
      const text = json.content?.find((c) => c.type === 'text')?.text ?? '';

      const title = extractTitle(text);
      if (!title) throw new Error(`No title in model response: ${text.slice(0, 200)}`);

      return title.slice(0, MAX_TITLE_LENGTH);
    } catch (err) {
      this.logger.error('Title suggestion failed', err);
      throw new ServiceUnavailableException('Could not generate a title suggestion right now — please try again.');
    }
  }
}
