/**
 * Integration tests — Admin shipping methods and zones
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

describe('Admin — Shipping', () => {
  it('GET /admin/shipping/methods', async () => {
    if (skip()) return;
    const res = await api('/admin/shipping/methods', { token });
    expectAlive(res, 'GET /admin/shipping/methods');
  });

  it('GET /admin/shipping/zones', async () => {
    if (skip()) return;
    const res = await api('/admin/shipping/zones', { token });
    expectAlive(res, 'GET /admin/shipping/zones');
  });
});
