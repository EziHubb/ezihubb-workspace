/**
 * Integration tests — Seller analytics, reviews, payouts
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

describe('Seller — Analytics', () => {
  it('GET /seller/analytics/revenue', async () => {
    if (skip()) return;
    const res = await api('/seller/analytics/revenue', { token });
    expectAlive(res, 'GET /seller/analytics/revenue');
  });

  it('GET /seller/analytics/top-products', async () => {
    if (skip()) return;
    const res = await api('/seller/analytics/top-products', { token });
    expectAlive(res, 'GET /seller/analytics/top-products');
  });
});

describe('Seller — Reviews', () => {
  it('GET /seller/reviews', async () => {
    if (skip()) return;
    const res = await api('/seller/reviews?limit=5', { token });
    expectAlive(res, 'GET /seller/reviews');
  });
});

describe('Seller — Payouts', () => {
  it('GET /seller/payouts', async () => {
    if (skip()) return;
    const res = await api('/seller/payouts?limit=5', { token });
    expectAlive(res, 'GET /seller/payouts');
  });
});
