/**
 * Integration tests — Admin catalog (categories, tags, collections, shop sections)
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

describe('Admin — Catalog', () => {
  it('GET /admin/categories', async () => {
    if (skip()) return;
    const res = await api('/admin/categories', { token });
    expectAlive(res, 'GET /admin/categories');
  });

  it('GET /admin/tags', async () => {
    if (skip()) return;
    const res = await api('/admin/tags?limit=5', { token });
    expectAlive(res, 'GET /admin/tags');
  });

  it('GET /admin/collections', async () => {
    if (skip()) return;
    const res = await api('/admin/collections?limit=5', { token });
    expectAlive(res, 'GET /admin/collections');
  });

  it('GET /admin/shop-sections', async () => {
    if (skip()) return;
    const res = await api('/admin/shop-sections', { token });
    expectAlive(res, 'GET /admin/shop-sections');
  });
});
