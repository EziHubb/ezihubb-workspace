/**
 * Integration tests — Seller store (stores/me, analytics, application)
 */
import { api, login, expectAlive } from '../helpers';

const EMAIL    = process.env['TEST_SELLER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_SELLER_PASSWORD'] ?? '';
let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
  else console.warn('⚠  TEST_SELLER_EMAIL / TEST_SELLER_PASSWORD not set — skipping seller tests');
});
const skip = () => !token;

describe('Seller — Store', () => {
  it('GET /stores/me', async () => {
    if (skip()) return;
    const res = await api('/stores/me', { token });
    expectAlive(res, 'GET /stores/me');
    expect(res.status).toBe(200);
  });

  it('GET /stores/me/application', async () => {
    if (skip()) return;
    const res = await api('/stores/me/application', { token });
    expectAlive(res, 'GET /stores/me/application');
  });

  it('GET /stores/me/analytics', async () => {
    if (skip()) return;
    const res = await api('/stores/me/analytics', { token });
    expectAlive(res, 'GET /stores/me/analytics');
  });
});
