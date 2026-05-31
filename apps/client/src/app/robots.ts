import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow:  [
          '/account/',
          '/checkout/',
          '/admin/',
          '/search',      // dynamic query results — no SEO value
          '/api/',
        ],
      },
    ],
    sitemap: 'https://maplehandmade.com/sitemap.xml',
  };
}
