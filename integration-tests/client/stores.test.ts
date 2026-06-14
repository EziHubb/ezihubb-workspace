/**
 * Integration tests — Store public endpoints
 */
import { api, expectAlive } from '../helpers';

const STORE_SLUG = process.env['TEST_STORE_SLUG'] ?? 'sophie-creator';

describe('Stores', () => {
  it('GET /stores — public list', async () => {
    const res = await api('/stores?limit=5');
    expectAlive(res, 'GET /stores');
  });

  it('GET /stores/:slug — endpoint exists (404 = data not seeded)', async () => {
    const res = await api(`/stores/${STORE_SLUG}`);
    // 404 "Store not found" is valid — endpoint is wired, test data may be missing
    expect(res.status).not.toBe(500);
    expect(res.status).not.toBe(502);
  });

  it('GET /stores/:slug/reviews — endpoint exists', async () => {
    const res = await api(`/stores/${STORE_SLUG}/reviews`);
    expect(res.status).not.toBe(500);
    expect(res.status).not.toBe(502);
  });

  it('GET /stores/plans — public seller plans', async () => {
    const res = await api('/stores/plans');
    expectAlive(res, 'GET /stores/plans');
  });
});
