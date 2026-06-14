/**
 * Integration tests — Admin promotions (coupons, gift cards, promotions)
 */
import { api, login, expectAlive } from '../helpers';

const EMAIL    = process.env['TEST_ADMIN_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? '';
let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
  else console.warn('⚠  TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set — skipping');
});
const skip = () => !token;

describe('Admin — Promotions', () => {
  it('GET /admin/promotions', async () => {
    if (skip()) return;
    const res = await api('/admin/promotions?limit=5', { token });
    expectAlive(res, 'GET /admin/promotions');
  });

  it('GET /admin/coupons', async () => {
    if (skip()) return;
    const res = await api('/admin/coupons?limit=5', { token });
    expectAlive(res, 'GET /admin/coupons');
  });

  it('GET /admin/gift-cards', async () => {
    if (skip()) return;
    const res = await api('/admin/gift-cards?limit=5', { token });
    expectAlive(res, 'GET /admin/gift-cards');
  });
});
