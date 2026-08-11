import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SetMetadata } from '@nestjs/common';
import {
  TranslationService,
  type TranslatableEntityType,
} from '../../modules/translations/translation.service';
import { extractLocale, type LocaleRequest } from '../utils/locale.util';

export const TRANSLATE_ENTITY_KEY = 'translate_entity';

/** Decorator — apply to controller class or method to enable auto-translation. */
export const TranslatableResponse = (entityType: TranslatableEntityType) =>
  SetMetadata(TRANSLATE_ENTITY_KEY, entityType);

@Injectable()
export class I18nInterceptor implements NestInterceptor {
  constructor(
    private readonly translationService: TranslationService,
    private readonly reflector:          Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.getAllAndOverride<TranslatableEntityType | undefined>(
      TRANSLATE_ENTITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!entityType) return next.handle();

    const request = context.switchToHttp().getRequest<LocaleRequest>();

    const locale = extractLocale(request);
    if (locale === 'en') return next.handle();

    return next.handle().pipe(
      map(async (response: unknown) => {
        if (!response || typeof response !== 'object') return response;
        const res = response as Record<string, unknown>;
        if (!res['data']) return response;

        const data = res['data'];

        // Array response (list endpoints)
        if (Array.isArray(data)) {
          const ids = (data as Record<string, unknown>[]).map((i) => i['id'] as string).filter(Boolean);
          const translations = await this.translationService.getBatchTranslations(entityType, ids, locale);
          return {
            ...res,
            data: (data as Record<string, unknown>[]).map((item) =>
              this.translationService.applyTranslations(item, translations[item['id'] as string] ?? {}),
            ),
          };
        }

        // Paginated response { data: [...], pagination: {...} }
        if (typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>)['data'])) {
          const inner = (data as Record<string, unknown>)['data'] as Record<string, unknown>[];
          const ids   = inner.map((i) => i['id'] as string).filter(Boolean);
          const translations = await this.translationService.getBatchTranslations(entityType, ids, locale);
          return {
            ...res,
            data: {
              ...(data as Record<string, unknown>),
              data: inner.map((item) =>
                this.translationService.applyTranslations(item, translations[item['id'] as string] ?? {}),
              ),
            },
          };
        }

        // Single object response
        if (typeof data === 'object' && data !== null && (data as Record<string, unknown>)['id']) {
          const id           = (data as Record<string, unknown>)['id'] as string;
          const translations = await this.translationService.getTranslations(entityType, id, locale);
          return {
            ...res,
            data: this.translationService.applyTranslations(data as Record<string, unknown>, translations),
          };
        }

        return response;
      }),
    );
  }
}
