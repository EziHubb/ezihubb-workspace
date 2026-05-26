import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.helper';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app    = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  afterEach(async () => {
    // Clean up test users between cases
    await prisma.user.deleteMany({ where: { email: { contains: '@e2e-test.com' } } });
  });

  // ── POST /api/v1/auth/register ─────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('201 — creates user and returns accessToken with user object', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email:     'alice@e2e-test.com',
          password:  'StrongPass1!',
          firstName: 'Alice',
          lastName:  'Test',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('alice@e2e-test.com');
      expect(res.body.data.user.passwordHash).toBeUndefined(); // not exposed
    });

    it('409 — returns ERR_EMAIL_TAKEN when email is already registered', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'bob@e2e-test.com', password: 'StrongPass1!', firstName: 'Bob', lastName: 'Test' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'bob@e2e-test.com', password: 'AnotherPass1!', firstName: 'Bob', lastName: 'Test2' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ERR_EMAIL_TAKEN');
    });

    it('400 — returns ERR_VALIDATION for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'bad@e2e-test.com' }); // missing password/name

      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/v1/auth/login ────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'login-user@e2e-test.com', password: 'StrongPass1!', firstName: 'Login', lastName: 'User' });
    });

    it('200 — returns accessToken and sets refresh_token cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login-user@e2e-test.com', password: 'StrongPass1!' });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('401 — returns ERR_CREDENTIALS_INVALID for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login-user@e2e-test.com', password: 'WrongPass!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ERR_CREDENTIALS_INVALID');
    });
  });

  // ── POST /api/v1/auth/refresh ──────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('200 — returns new accessToken when valid refresh cookie is present', async () => {
      // Register + login to get a refresh token cookie
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'refresh-user@e2e-test.com', password: 'StrongPass1!', firstName: 'Ref', lastName: 'User' });

      const cookies = loginRes.headers['set-cookie'] as string[];

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  // ── GET /api/v1/auth/verify-email ─────────────────────────────────────────

  describe('GET /api/v1/auth/verify-email', () => {
    it('400 — returns ERR_VERIFICATION_TOKEN_INVALID for an invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/verify-email')
        .query({ token: 'invalid-token-that-does-not-exist' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ERR_VERIFICATION_TOKEN_INVALID');
    });
  });
});
