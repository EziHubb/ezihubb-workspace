import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  TranslationService,
  TRANSLATABLE_FIELDS,
  type TranslatableEntityType,
  type TranslationMap,
} from './translation.service';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { AnthropicService } from '../../common/services/anthropic.service';

// Locales that receive automatic translation (never 'en')
const AUTO_TRANSLATE_LOCALES = ['vi', 'zh'];

export interface TranslateEntityJobData {
  entityType:        string;
  entityId:          string;
  sourceData:        Record<string, string>;
  locales:           string[];
  forceRetranslate:  boolean;
}

@Injectable()
export class AutoTranslateService {
  private readonly logger = new Logger(AutoTranslateService.name);

  constructor(
    private readonly config:             ConfigService,
    private readonly translationService: TranslationService,
    private readonly anthropic:          AnthropicService,
    @InjectQueue(QUEUES.TRANSLATIONS)
    private readonly translationQueue:   Queue,
  ) {}

  // ── TRIGGER (non-blocking, fire-and-forget) ───────────────────────────────────

  triggerTranslation(
    entityType:       TranslatableEntityType,
    entityId:         string,
    sourceData:       Record<string, string>,
    forceRetranslate  = false,
  ): void {
    const jobData: TranslateEntityJobData = {
      entityType,
      entityId,
      sourceData,
      locales:          AUTO_TRANSLATE_LOCALES,
      forceRetranslate,
    };

    this.translationQueue
      .add(JOBS.TRANSLATE_ENTITY, jobData, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: `translate:${entityType}:${entityId}:${Date.now()}`,
      })
      .catch((err: Error) =>
        this.logger.warn(
          `Failed to queue translation for ${entityType}:${entityId} — ${err.message}`,
        ),
      );
  }

  // ── PROCESS (called by BullMQ processor) ─────────────────────────────────────

  async translateEntity(
    entityType:       TranslatableEntityType,
    entityId:         string,
    sourceData:       Record<string, string>,
    locales:          string[],
    forceRetranslate: boolean,
  ): Promise<void> {
    const allowedFields  = TRANSLATABLE_FIELDS[entityType] ?? [];
    const fieldsToTranslate = allowedFields.filter((f) => sourceData[f]?.trim());

    if (fieldsToTranslate.length === 0) {
      this.logger.debug(`No translatable content for ${entityType}:${entityId}`);
      return;
    }

    for (const locale of locales) {
      try {
        // Skip if all fields already translated (unless forced)
        if (!forceRetranslate) {
          const existing   = await this.translationService.getTranslations(entityType, entityId, locale);
          const alreadyAll = fieldsToTranslate.every((f) => existing[f]);
          if (alreadyAll) {
            this.logger.debug(`${entityType}:${entityId} already has full ${locale} translations — skipping`);
            continue;
          }
        }

        const translated = await this.callTranslationAPI(
          fieldsToTranslate.map((f) => sourceData[f]!),
          'en',
          locale,
        );

        if (!translated) {
          this.logger.warn(`Translation API returned null for ${entityType}:${entityId} locale=${locale}`);
          continue;
        }

        // A null entry means that field could not be translated. Leaving it
        // out keeps the source text from being stored as a translation, and
        // leaves the field empty so the next run retries it.
        const translationMap: TranslationMap = {};
        fieldsToTranslate.forEach((field, i) => {
          if (translated[i]) translationMap[field] = translated[i]!;
        });

        const stored = Object.keys(translationMap).length;
        if (stored === 0) {
          this.logger.warn(`No field translated for ${entityType}:${entityId} locale=${locale} — nothing stored`);
          continue;
        }

        await this.translationService.setTranslations(
          entityType, entityId, locale, translationMap, true,
        );

        // Counts what was actually written, not what was attempted — the old
        // line reported a full success even when every field had failed.
        this.logger.log(
          `Auto-translated ${entityType}:${entityId} → ${locale} (${stored}/${fieldsToTranslate.length} fields)`,
        );

      } catch (err: unknown) {
        // CRITICAL: never throw — translation failure must not affect the entity
        this.logger.error(
          `Auto-translation failed for ${entityType}:${entityId} locale=${locale}: ${(err as Error).message}`,
        );
      }
    }
  }

  // ── TRANSLATION API ADAPTER ───────────────────────────────────────────────────

  /**
   * null = the whole request failed. A null ENTRY = that one string could not
   * be translated, and translateEntity skips it rather than storing something
   * wrong. Providers must never substitute the source text for a failure — see
   * translateWithMyMemory.
   */
  private async callTranslationAPI(
    texts:      string[],
    sourceLang: string,
    targetLang: string,
  ): Promise<(string | null)[] | null> {
    const provider = this.config.get<string>('TRANSLATE_PROVIDER', 'mymemory');

    if (provider === 'claude')   return this.translateWithClaude(texts, sourceLang, targetLang);
    if (provider === 'google')   return this.translateWithGoogle(texts, sourceLang, targetLang);
    if (provider === 'deepl')    return this.translateWithDeepL(texts, sourceLang, targetLang);
    if (provider === 'libre')    return this.translateWithLibre(texts, sourceLang, targetLang);
    if (provider === 'mymemory') return this.translateWithMyMemory(texts, sourceLang, targetLang);

    this.logger.warn(`Unknown TRANSLATE_PROVIDER: ${provider} — skipping auto-translation`);
    return null;
  }

  /**
   * Claude as a translation provider.
   *
   * Worth having alongside Google/DeepL because this is marketplace copy, not
   * documentation: listing titles and descriptions are full of product jargon,
   * brand-ish names and deliberate phrasing that a general translator flattens.
   * A model that is told what the text IS keeps that.
   *
   * All strings go in one call and come back as an array, so the batch stays
   * one request and the model can keep terminology consistent across fields —
   * translating a title and its description separately is how the same product
   * ends up named two different things.
   */
  private async translateWithClaude(
    texts:  string[],
    source: string,
    target: string,
  ): Promise<string[] | null> {
    if (!this.anthropic.isConfigured()) {
      this.logger.warn('ANTHROPIC_API_KEY not configured — skipping translation');
      return null;
    }

    try {
      const out = await this.anthropic.json<string[]>({
        system:
          `You translate e-commerce listing copy for a handmade and print-on-demand marketplace, from ${source} to ${target}.\n\n` +
          'Rules:\n' +
          '- Return ONLY a JSON array of strings, same length and same order as the input array\n' +
          '- Translate each string independently but keep terminology consistent across them\n' +
          '- Preserve any HTML tags, line breaks, emoji and placeholder tokens exactly as they appear\n' +
          '- Leave proper nouns, brand names and sizing codes untranslated\n' +
          '- Do not add, remove, explain or summarise anything',
        content:   JSON.stringify(texts),
        // Translations run longer than the source, and CJK costs more tokens
        // per character — budget well above the input rather than truncating
        // the last field of a batch.
        maxTokens: Math.min(8000, 1000 + texts.join('').length * 3),
        timeoutMs: 30_000,
      });

      // A short array would silently shift every field onto the wrong key, so
      // a mismatch is treated as a failed translation rather than partial data.
      if (!Array.isArray(out) || out.length !== texts.length) {
        this.logger.warn(`Claude returned ${Array.isArray(out) ? out.length : 'non-array'} for ${texts.length} inputs — discarding`);
        return null;
      }

      return out.map((t) => String(t));
    } catch (err) {
      this.logger.warn(`Claude translation failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async translateWithGoogle(
    texts:  string[],
    source: string,
    target: string,
  ): Promise<string[] | null> {
    const apiKey = this.config.get<string>('GOOGLE_TRANSLATE_API_KEY');
    if (!apiKey) {
      this.logger.warn('GOOGLE_TRANSLATE_API_KEY not configured — skipping translation');
      return null;
    }

    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ q: texts, source, target, format: 'text' }),
          signal:  AbortSignal.timeout(15_000),
        },
      );

      if (!response.ok) {
        this.logger.error(`Google Translate API error ${response.status}: ${await response.text()}`);
        return null;
      }

      const data = await response.json() as { data?: { translations?: { translatedText: string }[] } };
      return data.data?.translations?.map((t) => t.translatedText) ?? null;

    } catch (err: unknown) {
      this.logger.error(`Google Translate request failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async translateWithDeepL(
    texts:  string[],
    source: string,
    target: string,
  ): Promise<string[] | null> {
    const apiKey = this.config.get<string>('DEEPL_API_KEY');
    if (!apiKey) return null;

    try {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method:  'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body:   JSON.stringify({ text: texts, source_lang: source.toUpperCase(), target_lang: target.toUpperCase() }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return null;
      const data = await response.json() as { translations?: { text: string }[] };
      return data.translations?.map((t) => t.text) ?? null;

    } catch {
      return null;
    }
  }

  private async translateWithLibre(
    texts:  string[],
    source: string,
    target: string,
  ): Promise<string[] | null> {
    const apiUrl = this.config.get<string>('LIBRE_TRANSLATE_URL', 'https://libretranslate.com/translate');
    const apiKey = this.config.get<string>('LIBRE_TRANSLATE_KEY', '');

    try {
      const results: string[] = [];
      for (const text of texts) {
        const response = await fetch(apiUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ q: text, source, target, format: 'text', api_key: apiKey }),
          signal:  AbortSignal.timeout(15_000),
        });
        if (!response.ok) { results.push(text); continue; }
        const data = await response.json() as { translatedText?: string };
        results.push(data.translatedText ?? text);
      }
      return results;

    } catch {
      return null;
    }
  }

  /**
   * MyMemory public API — free, no API key required.
   * Rate limit: ~1,000 words/day anonymous, ~5,000 words/day with MYMEMORY_EMAIL set.
   * No batch endpoint, so each text is translated with its own request.
   */
  /**
   * MyMemory — free, no API key, one request per string.
   *
   * Setting MYMEMORY_EMAIL sends the `de` parameter, which moves the account
   * off the anonymous per-IP quota onto a much larger free one. Without it a
   * busy day silently exhausts the allowance.
   *
   * A failure yields null for that entry, never the source text. Substituting
   * the English original stored it as if it were a finished translation: the
   * shopper saw English under a Vietnamese locale, and translateEntity's
   * "already translated" check then skipped that field forever, so it never
   * recovered on its own.
   */
  private async translateWithMyMemory(
    texts:  string[],
    source: string,
    target: string,
  ): Promise<(string | null)[] | null> {
    const email = this.config.get<string>('MYMEMORY_EMAIL', '');
    if (!email) {
      this.logger.warn('MYMEMORY_EMAIL not set — using the anonymous quota, which is much smaller');
    }

    try {
      const results: (string | null)[] = [];
      for (const text of texts) {
        const url = new URL('https://api.mymemory.translated.net/get');
        url.searchParams.set('q', text);
        url.searchParams.set('langpair', `${source}|${target}`);
        if (email) url.searchParams.set('de', email);

        const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) {
          this.logger.warn(`MyMemory HTTP ${response.status} for ${source}→${target} — leaving this field untranslated`);
          results.push(null);
          continue;
        }

        const data = await response.json() as {
          responseStatus:  number | string;
          responseDetails?: string;
          responseData?:   { translatedText?: string };
        };

        // responseStatus is where the quota message arrives — the HTTP status
        // stays 200 while responseDetails reads "MYMEMORY WARNING: YOU USED
        // ALL AVAILABLE FREE TRANSLATIONS FOR TODAY". Checking res.ok alone
        // treated that warning text as a translation.
        const translated = data.responseData?.translatedText;
        if (Number(data.responseStatus) !== 200 || !translated) {
          this.logger.warn(`MyMemory refused a string (${data.responseStatus}): ${data.responseDetails ?? 'no detail'}`);
          results.push(null);
          continue;
        }

        results.push(translated);
      }
      return results;

    } catch (err: unknown) {
      this.logger.error(`MyMemory request failed: ${(err as Error).message}`);
      return null;
    }
  }
}
