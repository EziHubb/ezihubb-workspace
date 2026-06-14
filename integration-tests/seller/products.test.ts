/**
 * Integration tests — Seller products (scoped to own store)
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

describe('Seller — Products (scoped)', () => {
  it('GET /seller/products', async () => {
    if (skip()) return;
    const res = await api('/seller/products?limit=5', { token });
    expectAlive(res, 'GET /seller/products');
  });

  it('GET /admin/products (scoped to own store) → 200', async () => {
    if (skip()) return;
    const res = await api('/admin/products?limit=5', { token });
    expectAlive(res, 'GET /admin/products (seller-scoped)');
    expect(res.status).toBe(200);
  });

  it('GET /admin/products/stats (scoped)', async () => {
    if (skip()) return;
    const res = await api('/admin/products/stats', { token });
    expectAlive(res, 'GET /admin/products/stats (seller-scoped)');
  });
});
