'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { setLocaleGetter } from '@ezihubb/api-client';

/**
 * Registers the active UI locale with the shared api-client so every request
 * carries `X-Locale` — the API uses it to return translated product/category/
 * collection content (see I18nInterceptor + TranslationService on the API side).
 */
export function ApiLocaleSync() {
  const locale = useLocale();

  useEffect(() => {
    setLocaleGetter(() => locale);
  }, [locale]);

  return null;
}
