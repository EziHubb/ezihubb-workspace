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

        const translationMap: TranslationMap = {};
        fieldsToTranslate.forEach((field, i) => {
          if (translated[i]) translationMap[field] = translated[i]!;
        });

        await this.translationService.setTranslations(
          entityType, entityId, locale, translationMap, true,
        );

        this.logger.log(
          `Auto-translated ${entityType}:${entityId} → ${locale} (${fieldsToTranslate.length} fields)`,
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

  private async callTranslationAPI(
    texts:      string[],
    sourceLang: string,
    targetLang: string,
  ): Promise<string[] | null> {
    const provider = this.config.get<string>('TRANSLATE_PROVIDER', 'google');

    if (provider === 'google') return this.translateWithGoogle(texts, sourceLang, targetLang);
    if (provider === 'deepl')  return this.translateWithDeepL(texts, sourceLang, targetLang);
    if (provider === 'libre')  return this.translateWithLibre(texts, sourceLang, targetLang);

    this.logger.warn(`Unknown TRANSLATE_PROVIDER: ${provider} — skipping auto-translation`);
    return null;
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
}
