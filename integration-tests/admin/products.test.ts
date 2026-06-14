/**
 * Integration tests — Admin products
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

describe('Admin — Products', () => {
  it('GET /admin/products', async () => {
    if (skip()) return;
    const res = await api('/admin/products?limit=5', { token });
    expectList(res, 'GET /admin/products');
  });

  it('GET /admin/products/stats', async () => {
    if (skip()) return;
    const res = await api('/admin/products/stats', { token });
    expectAlive(res, 'GET /admin/products/stats');
  });
});
