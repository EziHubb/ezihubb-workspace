import { expect, test } from '@playwright/test';
import { createTranslator } from 'next-intl';
import en from '../messages/en/shops.json';
import vi from '../messages/vi/shops.json';
import zh from '../messages/zh/shops.json';
import { buildShopMetadata } from '../src/lib/shop-seo';

const shop: Parameters<typeof buildShopMetadata>[0] = {
  name: 'EziHubb',
  description: 'Personalized gifts and handcrafted keepsakes.',
  aboutHeadline: null,
  tagline: null,
  bannerUrl: 'https://images.example.test/shop-banner.jpg',
  logoUrl: null,
};

function metadata(store = shop, locale = 'en', messages = en, slug = 'ezihubb') {
  const t = createTranslator({ locale, messages, namespace: 'storePage' });
  return buildShopMetadata(store, {
    slug,
    locale,
    formatTitle: (name) => t('metaTitle', { name }),
    formatDescription: (name) => t('metaDescriptionFallback', { name }),
  });
}

test.describe('shop metadata contract', () => {
  for (const [locale, messages, title] of [
    ['en', en, 'EziHubb — Shop'],
    ['vi', vi, 'EziHubb — Cửa hàng'],
    ['zh', zh, 'EziHubb — 店铺'],
  ] as const) {
    test(`uses a descriptive title and localized canonical in ${locale}`, () => {
      const result = metadata(shop, locale, messages);
      expect(result.title).toEqual({ absolute: title });
      expect(result.openGraph).toMatchObject({ title, description: shop.description });
      expect(result.twitter).toMatchObject({ title, description: shop.description });
      expect(result.alternates?.canonical).toBe(`https://ezihubb.com/${locale}/shops/ezihubb`);
      expect(result.openGraph).toHaveProperty('url', result.alternates?.canonical);
      expect(result.alternates?.languages).toEqual({
        en: 'https://ezihubb.com/en/shops/ezihubb',
        vi: 'https://ezihubb.com/vi/shops/ezihubb',
        zh: 'https://ezihubb.com/zh/shops/ezihubb',
        'x-default': 'https://ezihubb.com/en/shops/ezihubb',
      });
    });
  }

  test('adds branding for another shop without repeating the platform shop brand', () => {
    expect(metadata({ ...shop, name: '  Handmade Studio  ' }).title)
      .toEqual({ absolute: 'Handmade Studio — Shop | EziHubb' });
    expect(metadata({ ...shop, name: '  ' }).title)
      .toEqual({ absolute: 'ezihubb — Shop' });
  });

  test('skips blank descriptions and uses the first nonempty shop detail', () => {
    expect(metadata({ ...shop, description: '  ', aboutHeadline: '  Our story  ' }).description)
      .toBe('Our story');
    expect(metadata({ ...shop, description: null, aboutHeadline: ' ', tagline: ' Our tagline ' }).description)
      .toBe('Our tagline');
  });

  test('uses a localized fallback in every description when all shop details are blank', () => {
    for (const [locale, messages] of [['en', en], ['vi', vi], ['zh', zh]] as const) {
      const result = metadata({ ...shop, description: ' ' }, locale, messages);
      const t = createTranslator({ locale, messages, namespace: 'storePage' });
      const description = t('metaDescriptionFallback', { name: 'EziHubb' });
      expect(result.description).toBe(description);
      expect(result.openGraph).toHaveProperty('description', description);
      expect(result.twitter).toHaveProperty('description', description);
    }
  });

  test('limits descriptions and falls back from banner to logo to the default image', () => {
    expect(metadata({ ...shop, description: 'x'.repeat(200) }).description).toHaveLength(160);
    for (const [bannerUrl, logoUrl, image] of [
      [shop.bannerUrl, null, shop.bannerUrl],
      [' ', 'https://images.example.test/logo.jpg', 'https://images.example.test/logo.jpg'],
      [null, null, '/og-default.jpg'],
    ] as const) {
      const result = metadata({ ...shop, bannerUrl, logoUrl });
      expect(result.openGraph).toHaveProperty('images', [image]);
      expect(result.twitter).toHaveProperty('images', [image]);
    }
  });
});
