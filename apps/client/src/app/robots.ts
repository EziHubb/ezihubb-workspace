import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = 'https://ezihubb.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/account/',
          '/checkout/',
          '/cart',
          '/api/',
          // NOTE: deliberately NOT blocking /_next/ — it only ever serves
          // build assets (JS/CSS chunks, fonts, images), and disallowing it
          // was flagged by Search Console as "Indexed, though blocked by
          // robots.txt" for a font file. Blocking it also prevents Googlebot
          // from fully rendering pages to evaluate layout/mobile-friendliness.
          '/admin/',
          '/orders/track',
          '/auth/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
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
