/**
 * Integration tests — Admin store management & applications
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

describe('Admin — Stores', () => {
  it('GET /admin/stores', async () => {
    if (skip()) return;
    const res = await api('/admin/stores?limit=5', { token });
    expectList(res, 'GET /admin/stores');
  });

  it('GET /admin/stores/applications', async () => {
    if (skip()) return;
    const res = await api('/admin/stores/applications?limit=5', { token });
    expectAlive(res, 'GET /admin/stores/applications');
  });
});
