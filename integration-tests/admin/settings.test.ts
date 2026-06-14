/**
 * Integration tests — Admin settings, team, audit logs, notifications
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

describe('Admin — Settings', () => {
  it('GET /admin/settings', async () => {
    if (skip()) return;
    const res = await api('/admin/settings', { token });
    expectAlive(res, 'GET /admin/settings');
  });

  it('GET /admin/settings/team', async () => {
    if (skip()) return;
    const res = await api('/admin/settings/team', { token });
    expectAlive(res, 'GET /admin/settings/team');
  });
});

describe('Admin — Audit logs', () => {
  it('GET /admin/audit-logs', async () => {
    if (skip()) return;
    const res = await api('/admin/audit-logs?limit=5', { token });
    expectAlive(res, 'GET /admin/audit-logs');
  });
});

describe('Admin — Notifications', () => {
  it('GET /admin/notifications/templates', async () => {
    if (skip()) return;
    const res = await api('/admin/notifications/templates', { token });
    expectAlive(res, 'GET /admin/notifications/templates');
  });
});
