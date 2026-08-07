import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

export const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  Product:     ['name', 'description', 'seoTitle', 'seoDescription'],
  Category:    ['name', 'description'],
  Collection:  ['name', 'description'],
  Tag:         ['name'],
  ShopSection: ['name'],
};

export type TranslatableEntityType = keyof typeof TRANSLATABLE_FIELDS;
export type TranslationMap = Record<string, string>;

const TTL_SECONDS = 3_600; // 1 hour

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  // ── READ: single entity ───────────────────────────────────────────────────────

  async getTranslations(
    entityType: TranslatableEntityType,
    entityId:   string,
    locale:     string,
  ): Promise<TranslationMap> {
    if (locale === 'en') return {};

    const cacheKey = `translations:${entityType}:${entityId}:${locale}`;
    const cached   = await this.redis.get<TranslationMap>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.translation.findMany({
      where:  { entityType, entityId, locale },
      select: { field: true, value: true },
    });

    const map: TranslationMap = {};
    for (const row of rows) map[row.field] = row.value;

    await this.redis.set(cacheKey, map, TTL_SECONDS);
    return map;
  }

  // ── READ: batch (for list endpoints) ─────────────────────────────────────────

  async getBatchTranslations(
    entityType: TranslatableEntityType,
    entityIds:  string[],
    locale:     string,
  ): Promise<Record<string, TranslationMap>> {
    if (locale === 'en' || entityIds.length === 0) return {};

    const rows = await this.prisma.translation.findMany({
      where:  { entityType, entityId: { in: entityIds }, locale },
      select: { entityId: true, field: true, value: true },
    });

    const result: Record<string, TranslationMap> = {};
    for (const row of rows) {
      if (!result[row.entityId]) result[row.entityId] = {};
      result[row.entityId]![row.field] = row.value;
    }
    return result;
  }

  // ── WRITE: upsert one field ───────────────────────────────────────────────────

  async setTranslation(
    entityType:      TranslatableEntityType,
    entityId:        string,
    locale:          string,
    field:           string,
    value:           string,
    isAutoTranslated = false,
  ): Promise<void> {
    if (locale === 'en') return;
    if (!TRANSLATABLE_FIELDS[entityType]?.includes(field)) {
      this.logger.warn(`Field "${field}" is not translatable for ${entityType}`);
      return;
    }

    await this.prisma.translation.upsert({
      where:  { entityType_entityId_locale_field: { entityType, entityId, locale, field } },
      create: { entityType, entityId, locale, field, value, isAutoTranslated },
      update: { value, isAutoTranslated, updatedAt: new Date() },
    });

    await this.redis.del(`translations:${entityType}:${entityId}:${locale}`);
  }

  // ── WRITE: bulk upsert ────────────────────────────────────────────────────────

  async setTranslations(
    entityType:      TranslatableEntityType,
    entityId:        string,
    locale:          string,
    translations:    TranslationMap,
    isAutoTranslated = false,
  ): Promise<void> {
    if (locale === 'en') return;

    const allowed     = TRANSLATABLE_FIELDS[entityType] ?? [];
    const validPairs  = Object.entries(translations).filter(([f]) => allowed.includes(f));
    if (validPairs.length === 0) return;

    await this.prisma.$transaction(
      validPairs.map(([field, value]) =>
        this.prisma.translation.upsert({
          where:  { entityType_entityId_locale_field: { entityType, entityId, locale, field } },
          create: { entityType, entityId, locale, field, value, isAutoTranslated },
          update: { value, isAutoTranslated, updatedAt: new Date() },
        }),
      ),
    );

    await this.redis.del(`translations:${entityType}:${entityId}:${locale}`);
  }

  // ── DELETE: clean up on entity removal ───────────────────────────────────────

  async deleteEntityTranslations(
    entityType: TranslatableEntityType,
    entityId:   string,
  ): Promise<void> {
    await this.prisma.translation.deleteMany({ where: { entityType, entityId } });
    // Best-effort cache eviction for all locales
    for (const locale of ['vi', 'zh']) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- best-effort cache eviction, stale cache just expires on TTL
      this.redis.del(`translations:${entityType}:${entityId}:${locale}`).catch(() => {});
    }
  }

  // ── APPLY: merge translation map onto any object ──────────────────────────────

  applyTranslations<T extends Record<string, unknown>>(
    entity:         T,
    translationMap: TranslationMap,
  ): T {
    if (Object.keys(translationMap).length === 0) return entity;

    const result = { ...entity };
    for (const [field, value] of Object.entries(translationMap)) {
      if (value && result[field] !== undefined) {
        (result as Record<string, unknown>)[field] = value;
      }
    }
    return result;
  }

  // ── READ: all locales for admin editor ────────────────────────────────────────

  async getAllLocaleTranslations(
    entityType: TranslatableEntityType,
    entityId:   string,
  ): Promise<Record<string, TranslationMap & { _isAutoTranslated?: Record<string, boolean> }>> {
    const rows = await this.prisma.translation.findMany({
      where:  { entityType, entityId },
      select: { locale: true, field: true, value: true, isAutoTranslated: true },
    });

    const result: Record<string, TranslationMap & { _isAutoTranslated?: Record<string, boolean> }> = {};
    for (const row of rows) {
      if (!result[row.locale]) result[row.locale] = {};
      result[row.locale]![row.field] = row.value;
    }
    return result;
  }
}
