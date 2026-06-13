import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = 'https://dailydaisy.com';
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
          '/_next/',
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
