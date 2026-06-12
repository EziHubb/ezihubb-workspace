import { createTestApp, closeTestApp, TestApp } from '../setup/app.setup';

describe('Products — /api/v1/products', () => {
  let testApp: TestApp;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    const adminReg = await testApp.request
      .post('/api/v1/auth/register')
      .send({
        email: `admin.prod.${Date.now()}@integration.test`,
        password: 'Test@123456',
        firstName: 'Admin',
        lastName: 'Test',
      });
    adminToken = adminReg.body.data.accessToken;

    const custReg = await testApp.request
      .post('/api/v1/auth/register')
      .send({
        email: `cust.prod.${Date.now()}@integration.test`,
        password: 'Test@123456',
        firstName: 'Cust',
        lastName: 'Test',
      });
    customerToken = custReg.body.data.accessToken;
  });

  afterAll(() => closeTestApp(testApp));

  // ── Public product endpoints ─────────────────────────────────────────────
  describe('Public product endpoints', () => {
    it('GET /products — returns paginated list (no auth required)', async () => {
      const res = await testApp.request.get('/api/v1/products').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /products/:slug — returns 404 for unknown slug', async () => {
      await testApp.request
        .get('/api/v1/products/this-slug-does-not-exist-xyz-abc-123')
        .expect(404);
    });

    it('GET /products/trending — returns array', async () => {
      const res = await testApp.request.get('/api/v1/products/trending').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── Admin product endpoints ──────────────────────────────────────────────
  describe('Admin product CRUD guards', () => {
    it('POST /admin/products — returns 401 without token', async () => {
      await testApp.request
        .post('/api/v1/admin/products')
        .send({ name: 'Unauthorized Product', basePrice: 9.99 })
        .expect(401);
    });

    it('POST /admin/products — returns 403 with customer token', async () => {
      await testApp.request
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Customer Hack', basePrice: 9.99 })
        .expect(403);
    });

    it('PATCH /admin/products/:id — returns 401 without token', async () => {
      await testApp.request
        .patch('/api/v1/admin/products/nonexistent-id')
        .send({ name: 'Ghost Product' })
        .expect(401);
    });
  });

  // ── Response shape ───────────────────────────────────────────────────────
  describe('Response shape', () => {
    it('Product list has success + data array', async () => {
      const res = await testApp.request.get('/api/v1/products').expect(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
