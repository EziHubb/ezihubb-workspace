/**
 * Integration tests — Seller orders (scoped to own store)
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

describe('Seller — Orders (scoped)', () => {
  it('GET /seller/orders', async () => {
    if (skip()) return;
    const res = await api('/seller/orders?limit=5', { token });
    expectAlive(res, 'GET /seller/orders');
  });

  it('GET /seller/orders/stats', async () => {
    if (skip()) return;
    const res = await api('/seller/orders/stats', { token });
    expectAlive(res, 'GET /seller/orders/stats');
  });

  it('GET /admin/orders (scoped to own store) → 200', async () => {
    if (skip()) return;
    const res = await api('/admin/orders?limit=5', { token });
    expectAlive(res, 'GET /admin/orders (seller-scoped)');
    expect(res.status).toBe(200);
  });
});
