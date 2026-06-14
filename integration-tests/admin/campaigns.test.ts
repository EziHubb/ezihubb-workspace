/**
 * Integration tests — Admin campaigns, flash deals, gift pools
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

describe('Admin — Campaigns & Flash Deals', () => {
  it('GET /admin/campaigns', async () => {
    if (skip()) return;
    const res = await api('/admin/campaigns?limit=5', { token });
    expectAlive(res, 'GET /admin/campaigns');
  });

  it('GET /admin/flash-deals', async () => {
    if (skip()) return;
    const res = await api('/admin/flash-deals?limit=5', { token });
    expectAlive(res, 'GET /admin/flash-deals');
  });
});

describe('Admin — Gift Pools', () => {
  it('GET /admin/gift-pools', async () => {
    if (skip()) return;
    const res = await api('/admin/gift-pools?limit=5', { token });
    expectAlive(res, 'GET /admin/gift-pools');
  });
});
