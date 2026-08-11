export const SUPPORTED_LOCALES = ['en', 'vi', 'zh'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleRequest {
  headers: Record<string, string | string[] | undefined>;
  path?: string;
  query?: Record<string, string>;
}

/**
 * Resolves the caller's locale for response translation.
 * Priority: explicit `X-Locale` header (set by the client's api-client on every
 * request) → `Accept-Language` → URL path prefix → `?locale=` query param → 'en'.
 */
export function extractLocale(request: LocaleRequest): SupportedLocale {
  const xLocale = request.headers['x-locale'];
  const xLocaleValue = Array.isArray(xLocale) ? xLocale[0] : xLocale;
  if (xLocaleValue && isSupportedLocale(xLocaleValue)) return xLocaleValue;

  const acceptLang = request.headers['accept-language'];
  const acceptLangValue = Array.isArray(acceptLang) ? acceptLang[0] : acceptLang;
  if (acceptLangValue) {
    const primary = acceptLangValue.split(',')[0]?.split(';')[0]?.trim() ?? '';
    const lang    = primary.split('-')[0]?.toLowerCase() ?? '';
    if (isSupportedLocale(lang)) return lang;
  }

  const urlLocale = request.path?.split('/')?.[1];
  if (urlLocale && isSupportedLocale(urlLocale)) return urlLocale;

  const queryLocale = request.query?.['locale'];
  if (queryLocale && isSupportedLocale(queryLocale)) return queryLocale;

  return 'en';
}

function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
