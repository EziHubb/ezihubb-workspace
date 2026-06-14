/**
 * Integration tests — Admin AI stats and NFT features
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

describe('Admin — AI', () => {
  it('GET /admin/ai/stats', async () => {
    if (skip()) return;
    const res = await api('/admin/ai/stats', { token });
    expectAlive(res, 'GET /admin/ai/stats');
  });
});

describe('Admin — NFT', () => {
  it('GET /admin/nft/drops', async () => {
    if (skip()) return;
    const res = await api('/admin/nft/drops?limit=5', { token });
    expectAlive(res, 'GET /admin/nft/drops');
  });

  it('GET /admin/nft/memberships', async () => {
    if (skip()) return;
    const res = await api('/admin/nft/memberships?limit=5', { token });
    expectAlive(res, 'GET /admin/nft/memberships');
  });
});
