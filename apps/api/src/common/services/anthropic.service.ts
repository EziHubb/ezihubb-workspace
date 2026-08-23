import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The one place this codebase talks to Claude.
 *
 * Five features call it — listing title suggestions, text and image
 * moderation, IP/trademark scanning, and auto-translation — and each used to
 * build its own URL, headers, and response parsing. That is how
 * ANTHROPIC_BASE_URL came to be honoured by some callers and hardcoded in
 * others: pointing half the traffic at a gateway and half at Anthropic off a
 * single key, with nothing in either service's own code to show the split.
 *
 * Everything endpoint-shaped lives here. Callers bring a prompt and get text.
 */

/** Sonnet: every job here is short and structured, with no long reasoning to
 *  pay Opus for, and the seller is usually waiting on the result. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

/**
 * Sonnet list price, USD per million tokens.
 *
 * Overridable because the endpoint may be a gateway that resells at its own
 * rate — a budget charged at the wrong price is not a budget. Only used to
 * report what a call cost; nothing here bills anyone.
 */
const DEFAULT_INPUT_USD_PER_MTOK  = 3;
const DEFAULT_OUTPUT_USD_PER_MTOK = 15;

export interface AnthropicUsage {
  inputTokens:  number;
  outputTokens: number;
  /** Computed from the token counts the API reported, not estimated. */
  costUsd:      number;
}

/** A user message: plain text, or the content blocks the image callers need. */
export type AnthropicContent = string | Record<string, unknown>[];

export interface AnthropicRequest {
  system?:    string;
  content:    AnthropicContent;
  maxTokens?: number;
  /** Overrides the configured model for one call. */
  model?:     string;
  timeoutMs?: number;
}

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly apiKey: string;
  private readonly model:  string;
  private readonly url:    string;
  private readonly inputUsdPerMTok:  number;
  private readonly outputUsdPerMTok: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY') ?? '';
    this.model  = this.config.get<string>('ANTHROPIC_MODEL')   ?? DEFAULT_ANTHROPIC_MODEL;

    this.inputUsdPerMTok  = Number(this.config.get('ANTHROPIC_INPUT_USD_PER_MTOK'))  || DEFAULT_INPUT_USD_PER_MTOK;
    this.outputUsdPerMTok = Number(this.config.get('ANTHROPIC_OUTPUT_USD_PER_MTOK')) || DEFAULT_OUTPUT_USD_PER_MTOK;

    // ANTHROPIC_BASE_URL names the API ROOT ("https://example.com"), not the
    // messages path, so a gateway can be swapped in without any caller knowing
    // the route. Trailing slashes are trimmed: a value copied from a browser
    // address bar usually carries one, and "…com//v1/messages" 404s on some
    // gateways.
    const root = (this.config.get<string>('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com').replace(/\/+$/, '');
    this.url = `${root}/v1/messages`;
  }

  /** False when no key is set, so callers can degrade instead of erroring. */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Sends one message and returns the model's text, with a markdown code
   * fence stripped if it wrapped its answer in one.
   *
   * "Return only JSON" is a request, not a guarantee — models routinely fence
   * it, and a gateway may route to one that does so more often than the model
   * a given prompt was written against. Stripping here means a formatting
   * habit never reaches a caller's JSON.parse as an outage.
   */
  async message(req: AnthropicRequest): Promise<string> {
    return (await this.send(req)).text;
  }

  /**
   * Same call, with what it cost.
   *
   * Cost comes from the token counts in the response, so it is what was
   * actually consumed rather than a per-call average — an image check runs
   * several times a text one, and averaging the two makes any budget built on
   * it meaningless.
   */
  async send(req: AnthropicRequest): Promise<{ text: string; usage: AnthropicUsage }> {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        // Both on purpose: Anthropic reads x-api-key, several compatible
        // gateways read the bearer token instead. Sending both works with
        // either and costs nothing.
        'x-api-key':         this.apiKey,
        'authorization':     `Bearer ${this.apiKey}`,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      req.model ?? this.model,
        max_tokens: req.maxTokens ?? 400,
        ...(req.system ? { system: req.system } : {}),
        messages:   [{ role: 'user', content: req.content }],
      }),
      signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
    });

    if (!res.ok) {
      // The body is where a gateway says WHICH thing is wrong — unknown model,
      // bad key, no credit. Without it every failure reads the same in the log
      // and the next person re-derives it from scratch.
      const detail = await res.text().catch(() => '');
      throw new Error(`Claude API error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const json: {
      content?: { type: string; text: string }[];
      usage?:   { input_tokens?: number; output_tokens?: number };
    } = await res.json();

    const raw  = json.content?.find((c) => c.type === 'text')?.text ?? '';
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    // Missing usage counts as zero rather than throwing: a gateway that omits
    // the block should not fail a call that already succeeded. It under-reports
    // spend, which is why the daily budget is a second line of defence behind
    // the call ceiling, not the only one.
    const inputTokens  = json.usage?.input_tokens  ?? 0;
    const outputTokens = json.usage?.output_tokens ?? 0;

    return {
      text,
      usage: {
        inputTokens,
        outputTokens,
        costUsd:
          (inputTokens  / 1_000_000) * this.inputUsdPerMTok +
          (outputTokens / 1_000_000) * this.outputUsdPerMTok,
      },
    };
  }

  /**
   * Same call, parsed as JSON.
   *
   * Falls back to the first {...} or [...] found in the text, which covers a
   * model that adds a sentence around the object it was asked for. A failure
   * carries the text along, since "invalid JSON" without the text is the least
   * actionable log line there is.
   */
  async json<T>(req: AnthropicRequest): Promise<T> {
    return (await this.jsonWithUsage<T>(req)).data;
  }

  /** As `json`, plus what the call cost — for callers holding a budget. */
  async jsonWithUsage<T>(req: AnthropicRequest): Promise<{ data: T; usage: AnthropicUsage }> {
    const { text, usage } = await this.send(req);

    const candidates = [text, text.match(/[{[][\s\S]*[}\]]/)?.[0]].filter(Boolean) as string[];
    for (const candidate of candidates) {
      try {
        return { data: JSON.parse(candidate) as T, usage };
      } catch {
        // Not JSON in that shape — try the next.
      }
    }

    this.logger.warn(`Claude returned unparseable JSON: ${text.slice(0, 200)}`);
    throw new Error(`Claude returned unparseable JSON: ${text.slice(0, 200)}`);
  }
}
