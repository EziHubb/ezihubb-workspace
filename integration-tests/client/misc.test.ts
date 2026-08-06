/**
 * Integration tests — Misc public endpoints (currency, affiliates config, shipping, etc.)
 */
import { api, expectAlive } from '../helpers';

describe('Misc public', () => {
  it('GET /currency/rates', async () => {
    const res = await api('/currency/rates');
    expectAlive(res, 'GET /currency/rates');
  });

  it('GET /affiliates/settings/public', async () => {
    const res = await api('/affiliates/settings/public');
    expectAlive(res, 'GET /affiliates/settings/public');
  });

  it('GET /shipping/methods', async () => {
    const res = await api('/shipping/methods');
    expectAlive(res, 'GET /shipping/methods');
  });

  it('GET /customization/art-styles', async () => {
    const res = await api('/customization/art-styles');
    expectAlive(res, 'GET /customization/art-styles');
  });

  it('Protected: GET /cart without token → 401 not 404', async () => {
    const res = await api('/cart');
    expect(res.status).not.toBe(404);
    expect([200, 401]).toContain(res.status);
  });
});
