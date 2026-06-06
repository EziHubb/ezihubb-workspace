export const SEO_DOMAIN = 'https://mapleloomhandmade.com';

/** Build canonical + hreflang alternates for a given site-relative path (e.g. '/categories/mugs'). */
export function buildAlternates(path: string, locale?: string) {
  const localePrefix = locale && locale !== 'en' ? `/${locale}` : '';
  return {
    canonical: `${SEO_DOMAIN}${localePrefix}${path}`,
    languages: {
      'en':        `${SEO_DOMAIN}${path}`,
      'vi':        `${SEO_DOMAIN}/vi${path}`,
      'x-default': `${SEO_DOMAIN}${path}`,
    },
  };
}
