/**
 * Security regression test — verifies ALL admin endpoints enforce auth.
 * Catches any admin endpoint accidentally left unprotected.
 */
import { createTestApp, closeTestApp, TestApp } from '../setup/app.setup';

const ADMIN_ENDPOINTS: Array<{ method: string; path: string }> = [
  { method: 'get',   path: '/api/v1/admin/products' },
  { method: 'get',   path: '/api/v1/admin/orders' },
  { method: 'get',   path: '/api/v1/admin/customers' },
  { method: 'get',   path: '/api/v1/admin/stores' },
  { method: 'get',   path: '/api/v1/admin/payouts' },
  { method: 'get',   path: '/api/v1/admin/moderation/queue' },
  { method: 'get',   path: '/api/v1/admin/settings/store' },
  { method: 'get',   path: '/api/v1/admin/team' },
  { method: 'get',   path: '/api/v1/admin/email-templates' },
  { method: 'get',   path: '/api/v1/admin/ai/stats' },
  { method: 'get',   path: '/api/v1/admin/ai/trend-drafts/pending-count' },
];

describe('Admin guard — all admin routes require auth', () => {
  let testApp: TestApp;
  let customerToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const reg = await testApp.request
      .post('/api/v1/auth/register')
      .send({
        email: `guard.cust.${Date.now()}@integration.test`,
        password: 'Test@123456',
        firstName: 'G',
        lastName: 'C',
      });
    customerToken = reg.body.data.accessToken;
  });

  afterAll(() => closeTestApp(testApp));

  ADMIN_ENDPOINTS.forEach(({ method, path }) => {
    it(`${method.toUpperCase()} ${path} — returns 401/403 without token`, async () => {
      const res = await (testApp.request as any)[method](path);
      expect([401, 403]).toContain(res.status);
    });

    it(`${method.toUpperCase()} ${path} — returns 403 with customer token`, async () => {
      const res = await (testApp.request as any)[method](path).set(
        'Authorization',
        `Bearer ${customerToken}`,
      );
      expect(res.status).toBe(403);
    });
  });
});
