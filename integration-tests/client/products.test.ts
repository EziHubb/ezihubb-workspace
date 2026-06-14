/**
 * Integration tests — Public product endpoints
 */
import { api, expectAlive, expectList, expectDetail } from '../helpers';

const PRODUCT_SLUG = process.env['TEST_PRODUCT_SLUG'] ?? 'custom-pet-portrait-pillow';

describe('Products — public', () => {
  it('GET /products — list', async () => {
    const res = await api('/products?limit=5&isActive=true');
    expectList(res, 'GET /products');
  });

  it('GET /products (sort=bestseller)', async () => {
    const res = await api('/products?limit=5&sort=bestseller&isActive=true');
    expectList(res, 'GET /products?sort=bestseller');
  });

  it('GET /products/:slug — detail', async () => {
    const res = await api(`/products/${PRODUCT_SLUG}`);
    expectDetail(res, `GET /products/${PRODUCT_SLUG}`);
  });

  it('GET /products/:slug/reviews', async () => {
    const res = await api(`/products/${PRODUCT_SLUG}/reviews`);
    expectAlive(res, `GET /products/${PRODUCT_SLUG}/reviews`);
  });

  it('GET /products/:slug/reviews/summary', async () => {
    const res = await api(`/products/${PRODUCT_SLUG}/reviews/summary`);
    expectAlive(res, `GET /products/${PRODUCT_SLUG}/reviews/summary`);
  });

  it('GET /products/:slug/related', async () => {
    const res = await api(`/products/${PRODUCT_SLUG}/related`);
    expectAlive(res, `GET /products/${PRODUCT_SLUG}/related`);
  });

  it('GET /products/trending', async () => {
    const res = await api('/products/trending');
    expectAlive(res, 'GET /products/trending');
  });

  it('GET /products/:slug/questions', async () => {
    const res = await api(`/products/${PRODUCT_SLUG}/questions`);
    expectAlive(res, `GET /products/${PRODUCT_SLUG}/questions`);
  });
});
