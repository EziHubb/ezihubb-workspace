import * as request from 'supertest';
import { createTestApp, closeTestApp, TestApp } from '../setup/app.setup';

describe('Auth — /api/v1/auth', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  // ── POST /auth/register ──────────────────────────────────────────────────
  describe('POST /auth/register', () => {
    it('returns 201 + accessToken on valid registration', async () => {
      const res = await testApp.request
        .post('/api/v1/auth/register')
        .send({
          email: `test.${Date.now()}@integration.test`,
          password: 'Test@123456',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('returns 409 on duplicate email', async () => {
      const email = `dup.${Date.now()}@integration.test`;
      await testApp.request.post('/api/v1/auth/register').send({
        email,
        password: 'Test@123456',
        firstName: 'A',
        lastName: 'B',
      });

      const res = await testApp.request
        .post('/api/v1/auth/register')
        .send({ email, password: 'Test@123456', firstName: 'A', lastName: 'B' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 on invalid email format', async () => {
      await testApp.request
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'Test@123456', firstName: 'A', lastName: 'B' })
        .expect(400);
    });

    it('returns 400 on weak password', async () => {
      await testApp.request
        .post('/api/v1/auth/register')
        .send({ email: `weak.${Date.now()}@integration.test`, password: '123', firstName: 'A', lastName: 'B' })
        .expect(400);
    });
  });

  // ── POST /auth/login ─────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    it('returns 200 + tokens on valid credentials', async () => {
      const email = `login.${Date.now()}@integration.test`;
      await testApp.request.post('/api/v1/auth/register').send({
        email,
        password: 'Test@123456',
        firstName: 'A',
        lastName: 'B',
      });

      const res = await testApp.request
        .post('/api/v1/auth/login')
        .send({ email, password: 'Test@123456' })
        .expect(200);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('returns 401 on wrong password', async () => {
      const res = await testApp.request
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'wrongpassword' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ── GET /auth/me ─────────────────────────────────────────────────────────
  describe('GET /auth/me', () => {
    it('returns 401 without token', async () => {
      await testApp.request.get('/api/v1/auth/me').expect(401);
    });

    it('returns user data with valid token', async () => {
      const email = `me.${Date.now()}@integration.test`;
      const reg = await testApp.request.post('/api/v1/auth/register').send({
        email,
        password: 'Test@123456',
        firstName: 'Jane',
        lastName: 'Doe',
      });
      const token = reg.body.data.accessToken;

      const res = await testApp.request
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.email).toBe(email);
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });
  });
});
