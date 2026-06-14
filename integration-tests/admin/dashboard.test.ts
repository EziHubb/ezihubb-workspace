/**
 * Integration tests — Admin dashboard / analytics
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

describe('Admin — Dashboard / Analytics', () => {
  it('GET /admin/analytics/kpis', async () => {
    if (skip()) return;
    const res = await api('/admin/analytics/kpis', { token });
    expectAlive(res, 'GET /admin/analytics/kpis');
  });

  it('GET /admin/analytics/revenue', async () => {
    if (skip()) return;
    const res = await api('/admin/analytics/revenue', { token });
    expectAlive(res, 'GET /admin/analytics/revenue');
  });

  it('GET /admin/analytics/top-products', async () => {
    if (skip()) return;
    const res = await api('/admin/analytics/top-products', { token });
    expectAlive(res, 'GET /admin/analytics/top-products');
  });
});
