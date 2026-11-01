import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { createTranslator } from 'next-intl';
import { ApiRequestError, type ProductDetailDto } from '@ezihubb/types';
import { api } from '@ezihubb/api-client';
import { buildProductMetadata } from './product-seo';
import { buildShopMetadata } from './shop-seo';
import sitemap from '../app/sitemap';
import en from '../../messages/en/shops.json';
import vi from '../../messages/vi/shops.json';
import zh from '../../messages/zh/shops.json';

const product = {
  name: 'Saja Boy Wrap Skort', slug: 'saja-boy-wrap-skort', sku: 'SKORT-1',
  shortDescription: '  ', description: 'Made to order.\n Choose your size.',
  basePrice: 30, compareAtPrice: null, salePromo: null, variants: [], isActive: true,
  images: [{ url: 'https://cdn.example.test/secondary.jpg', isPrimary: false },
    { url: 'https://cdn.example.test/primary.jpg', isPrimary: true }],
} as ProductDetailDto;

nodeTest('product metadata uses nonempty copy and the same canonical/title for search and sharing', () => {
  const result = buildProductMetadata(product, 'en');
  assert.deepEqual(result.title, { absolute: 'Saja Boy Wrap Skort | EziHubb' });
  assert.equal(result.description, 'Made to order. Choose your size.');
  assert.equal(result.alternates?.canonical, 'https://ezihubb.com/en/products/saja-boy-wrap-skort');
  assert.deepEqual(result.openGraph, {
    title: 'Saja Boy Wrap Skort | EziHubb', description: result.description,
    type: 'website', siteName: 'EziHubb', url: result.alternates?.canonical,
    images: [{ url: 'https://cdn.example.test/primary.jpg', alt: product.name }],
  });
  assert.equal(result.other?.['product:price:amount'], '30');
});

nodeTest('product descriptions fall back to the product name and stay bounded', () => {
  assert.equal(buildProductMetadata({ ...product, description: '' }, 'vi').description, product.name);
  const result = buildProductMetadata({ ...product, shortDescription: 'x'.repeat(200), images: [] }, 'zh');
  assert.equal(result.description?.length, 160);
  assert.equal(result.alternates?.canonical, 'https://ezihubb.com/zh/products/saja-boy-wrap-skort');
  assert.deepEqual(result.twitter, {
    card: 'summary_large_image', title: 'Saja Boy Wrap Skort | EziHubb', description: result.description,
    images: [{ url: '/og-default.jpg', width: 1200, height: 630 }],
  });
});

nodeTest('shop titles remain meaningful in all supported languages, including blank legacy names', () => {
  for (const [locale, messages, expected] of [
    ['en', en, 'EziHubb — Shop'], ['vi', vi, 'EziHubb — Cửa hàng'], ['zh', zh, 'EziHubb — 店铺'],
  ] as const) {
    const t = createTranslator({ locale, messages, namespace: 'storePage' });
    const options = { slug: 'ezihubb', locale,
      formatTitle: (name: string) => t('metaTitle', { name }),
      formatDescription: (name: string) => t('metaDescriptionFallback', { name }) };
    const shop = { name: 'EziHubb', description: ' ', aboutHeadline: null, tagline: null, bannerUrl: null, logoUrl: null };
    const result = buildShopMetadata(shop, options);
    assert.deepEqual(result.title, { absolute: expected });
    assert.equal(result.description, t('metaDescriptionFallback', { name: 'EziHubb' }));
    assert.equal(result.alternates?.canonical, `https://ezihubb.com/${locale}/shops/ezihubb`);
    assert.deepEqual(buildShopMetadata({ ...shop, name: ' ' }, options).title,
      { absolute: t('metaTitle', { name: 'ezihubb' }) });
  }
});

nodeTest('sitemap traverses paginated catalogs, lists localized shops/products and only canonical filter pages', async () => {
  const original = globalThis.fetch;
  const requests: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const page = Number(url.searchParams.get('page') ?? 1);
    let data: unknown;
    if (url.pathname.endsWith('/products')) {
      assert.equal(url.searchParams.get('limit'), '48');
      assert.equal(url.searchParams.has('fields'), false);
      data = { data: [{ slug: `product-${page}`, name: 'Custom mug', images: [{ url: 'https://cdn.example.test/mug.jpg' }] }], pagination: { hasNext: page === 1 } };
    } else if (url.pathname.endsWith('/stores')) {
      data = { data: [{ slug: `shop-${page}` }], pagination: { hasNext: page === 1 } };
    } else if (url.pathname.endsWith('/categories')) {
      data = [{ slug: 'parent', children: [{ slug: 'leaf' }] }];
    } else if (url.pathname.endsWith('/collections')) {
      data = [{ slug: 'gifts', updatedAt: '2026-10-15T00:00:00.000Z' }];
    } else {
      throw new Error(`Unexpected sitemap request: ${url.pathname}`);
    }
    return Response.json({ success: true, data });
  };
  try {
    const result = await sitemap();
    assert.equal(new Set(result.map((item) => item.url)).size, result.length);
    for (const locale of ['en', 'vi', 'zh']) {
      for (const path of ['products/product-1', 'products/product-2', 'shops/shop-1', 'shops/shop-2']) {
        const entry = result.find((item) => item.url === `https://ezihubb.com/${locale}/${path}`);
        assert.ok(entry, `Missing ${locale}/${path}`);
        assert.equal(entry.lastModified, undefined, 'Missing timestamps must not become fabricated update dates');
        assert.equal(entry.alternates?.languages?.en, `https://ezihubb.com/en/${path}`);
      }
    }
    assert.ok(result.some((item) => item.url.endsWith('/en/search?category=leaf')));
    assert.ok(!result.some((item) => item.url.includes('category=parent') || item.url.includes('?tags=')));
    assert.ok(requests.some((url) => url.pathname.endsWith('/stores') && url.searchParams.get('page') === '2'));
    assert.deepEqual(result.find((item) => item.url.endsWith('/en/products/product-1'))?.images,
      ['https://cdn.example.test/mug.jpg']);
  } finally {
    globalThis.fetch = original;
  }
});

nodeTest('sitemap includes every translated product beyond the former top-100 cutoff', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    return Response.json({ data: url.pathname.endsWith('/products')
      ? { data: Array.from({ length: 101 }, (_, i) => ({ slug: `product-${i}` })), pagination: { hasNext: false } }
      : [] });
  };
  try {
    const result = await sitemap();
    assert.ok(result.some((item) => item.url === 'https://ezihubb.com/vi/products/product-100'));
    assert.ok(result.some((item) => item.url === 'https://ezihubb.com/zh/products/product-100'));
  } finally {
    globalThis.fetch = original;
  }
});


nodeTest('catalog reads distinguish actual missing pages from temporary API failures', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [404, 503]) {
      globalThis.fetch = async () => Response.json({ success: false, error: { message: 'Synthetic failure' } }, { status });
      await assert.rejects(api.get('/products/synthetic'), (error: unknown) =>
        error instanceof ApiRequestError && error.statusCode === status);
    }
    globalThis.fetch = async () => { throw new TypeError('Synthetic network failure'); };
    await assert.rejects(api.get('/stores/synthetic'), TypeError);
  } finally {
    globalThis.fetch = original;
  }
});
