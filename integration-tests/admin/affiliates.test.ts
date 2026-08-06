/**
 * Integration tests — Admin affiliates, referrals, creators, messages
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

describe('Admin — Affiliates & Referrals', () => {
  it('GET /admin/affiliates', async () => {
    if (skip()) return;
    const res = await api('/admin/affiliates?limit=5', { token });
    expectAlive(res, 'GET /admin/affiliates');
  });

  it('GET /admin/referrals', async () => {
    if (skip()) return;
    const res = await api('/admin/referrals?limit=5', { token });
    expectAlive(res, 'GET /admin/referrals');
  });

  it('GET /admin/creators', async () => {
    if (skip()) return;
    const res = await api('/admin/creators?limit=5', { token });
    expectAlive(res, 'GET /admin/creators');
  });
});

describe('Admin — Messages', () => {
  it('GET /admin/messages', async () => {
    if (skip()) return;
    const res = await api('/admin/messages?limit=5', { token });
    expectAlive(res, 'GET /admin/messages');
  });
});
