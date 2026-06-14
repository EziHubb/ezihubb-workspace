/**
 * Integration tests — Seller shop sections (scoped to own store)
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

describe('Seller — Shop Sections', () => {
  it('GET /admin/shop-sections (scoped to own store) → 200', async () => {
    if (skip()) return;
    const res = await api('/admin/shop-sections', { token });
    expectAlive(res, 'GET /admin/shop-sections (seller-scoped)');
    expect(res.status).toBe(200);
  });
});
