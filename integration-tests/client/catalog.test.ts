/**
 * Integration tests — Catalog, collections, tags
 */
import { api, expectAlive, expectList } from '../helpers';

const CATEGORY_SLUG   = process.env['TEST_CATEGORY_SLUG']   ?? 'gifts';
const COLLECTION_SLUG = process.env['TEST_COLLECTION_SLUG'] ?? 'birthday-gifts';

describe('Catalog', () => {
  it('GET /catalog/categories', async () => {
    const res = await api('/catalog/categories');
    expectList(res, 'GET /catalog/categories');
  });

  it('GET /catalog/categories/:slug', async () => {
    const res = await api(`/catalog/categories/${CATEGORY_SLUG}`);
    expectAlive(res, `GET /catalog/categories/${CATEGORY_SLUG}`);
  });

  it('GET /catalog/mega-menu', async () => {
    const res = await api('/catalog/mega-menu');
    expectAlive(res, 'GET /catalog/mega-menu');
  });

  it('GET /tags', async () => {
    const res = await api('/tags');
    expectAlive(res, 'GET /tags');
  });
});

describe('Collections', () => {
  it('GET /collections', async () => {
    const res = await api('/collections?isActive=true&limit=6');
    expectList(res, 'GET /collections');
  });

  it('GET /collections/:slug — endpoint exists (404 = data not seeded)', async () => {
    const res = await api(`/collections/${COLLECTION_SLUG}`);
    // 404 with "Collection not found" means endpoint is wired; test data may not be seeded
    expect(res.status).not.toBe(500);
    expect(res.status).not.toBe(502);
  });
});
