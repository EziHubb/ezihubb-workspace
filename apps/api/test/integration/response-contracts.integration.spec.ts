/**
 * Verifies API response shapes match the contracts expected by the frontend.
 * Catches breaking changes before they reach production.
 */
import { createTestApp, closeTestApp, TestApp } from '../setup/app.setup';

describe('API Response Contracts', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(() => closeTestApp(testApp));

  it('All successful responses have { success: true, data: ... } shape', async () => {
    const res = await testApp.request.get('/api/v1/products').expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });

  it('All error responses have { success: false, error: { code, message } } shape', async () => {
    const res = await testApp.request
      .get('/api/v1/products/this-does-not-exist-xyz')
      .expect(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
    expect(typeof res.body.error.code).toBe('string');
  });

  it('User object in any response never contains passwordHash', async () => {
    const reg = await testApp.request.post('/api/v1/auth/register').send({
      email: `contract.${Date.now()}@integration.test`,
      password: 'Test@123456',
      firstName: 'C',
      lastName: 'T',
    });

    const body = JSON.stringify(reg.body);
    expect(body).not.toContain('passwordHash');
  });

  it('Unknown admin path returns 404 not 500', async () => {
    const res = await testApp.request.get('/api/v1/admin/nonexistent-feature-xyz');
    expect(res.status).toBe(404);
  });

  it('Products list returns array for data field', async () => {
    const res = await testApp.request.get('/api/v1/products').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
