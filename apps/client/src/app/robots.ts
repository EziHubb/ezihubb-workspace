import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = 'https://ezihubb.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Every real page lives under /[locale]/... (even the default
          // locale — there is no bare, unprefixed route; / and /cart 307 to
          // /en, /en/cart), so a bare '/cart' here never matches anything —
          // it only matches a path that doesn't exist. '/*/cart' uses the
          // wildcard Google/Bing both document support in robots.txt to
          // match the real /en/cart, /vi/cart, /zh/cart, etc. Kept the bare
          // versions too, in case a route is ever added outside [locale].
          '/account/',
          '/*/account/',
          '/checkout/',
          '/*/checkout/',
          '/cart',
          '/*/cart',
          '/api/',
          // NOTE: deliberately NOT blocking /_next/ — it only ever serves
          // build assets (JS/CSS chunks, fonts, images), and disallowing it
          // was flagged by Search Console as "Indexed, though blocked by
          // robots.txt" for a font file. Blocking it also prevents Googlebot
          // from fully rendering pages to evaluate layout/mobile-friendliness.
          '/admin/',
          '/orders/track',
          '/*/orders/track',
          '/auth/',
          '/*/auth/',
          '/login',
          '/*/login',
          '/register',
          '/*/register',
          '/forgot-password',
          '/*/forgot-password',
          '/reset-password',
          '/*/reset-password',
        ],
      },
      // Block AI training crawlers from scraping content
      {
        userAgent: 'GPTBot',
        disallow:  '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow:  '/',
      },
      {
        userAgent: 'CCBot',
        disallow:  '/',
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host:    base,
  };
}
