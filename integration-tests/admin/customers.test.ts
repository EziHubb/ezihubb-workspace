/**
 * Integration tests — Admin customers
 */
import { api, login, expectAlive, expectList } from '../helpers';

const EMAIL    = process.env['TEST_ADMIN_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? '';
let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
  else console.warn('⚠  TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set — skipping');
});
const skip = () => !token;

describe('Admin — Customers', () => {
  it('GET /admin/customers', async () => {
    if (skip()) return;
    const res = await api('/admin/customers?limit=5', { token });
    expectList(res, 'GET /admin/customers');
  });

  it('GET /admin/customers/stats', async () => {
    if (skip()) return;
    const res = await api('/admin/customers/stats', { token });
    expectAlive(res, 'GET /admin/customers/stats');
  });

  it('GET /admin/reviews', async () => {
    if (skip()) return;
    const res = await api('/admin/reviews?limit=5', { token });
    expectList(res, 'GET /admin/reviews');
  });
});
