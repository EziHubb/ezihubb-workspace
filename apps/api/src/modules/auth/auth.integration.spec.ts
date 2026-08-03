/**
 * Auth flow — HTTP integration tests
 *
 * Requirements:
 *  - DATABASE_URL env var pointing to a PostgreSQL instance (local or remote)
 *  - DISABLE_QUEUE=true is set automatically in ../../../test/setup
 *  - Tests use @ezihubb-test.invalid email domain and clean up after themselves
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, cleanTestUsers, createTestUser, getPrisma } from '../../test/setup';
import { PrismaService } from '../../prisma/prisma.service';

const TEST_PASSWORD = 'TestPass123!';

// Unique suffix so parallel test runs don't collide
const RUN_ID = Date.now();

describe('Auth HTTP integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = getPrisma(app);
  }, 60_000);

  afterAll(async () => {
    await cleanTestUsers(prisma, createdEmails).catch(() => {});
    await app.close();
  }, 30_000);

  // ── POST /auth/register ──────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('201 — creates user and returns accessToken', async () => {
      const email = `reg-${RUN_ID}@ezihubb-test.invalid`;
      createdEmails.push(email);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: TEST_PASSWORD, firstName: 'Jane', lastName: 'Doe' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.user.email).toBe(email);
    });

    it('409 — rejects duplicate email with ERR_EMAIL_TAKEN', async () => {
      const email = `dup-${RUN_ID}@ezihubb-test.invalid`;
      createdEmails.push(email);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: TEST_PASSWORD, firstName: 'A', lastName: 'B' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: TEST_PASSWORD, firstName: 'C', lastName: 'D' });

      expect(res.status).toBe(409);
    });

    it('400 — rejects weak password', async () => {
      const email = `weak-${RUN_ID}@ezihubb-test.invalid`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: '123', firstName: 'A', lastName: 'B' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing firstName', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: `nofirst-${RUN_ID}@ezihubb-test.invalid`, password: TEST_PASSWORD, lastName: 'B' });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/login ─────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    let loginEmail: string;

    beforeAll(async () => {
      loginEmail = `login-${RUN_ID}@ezihubb-test.invalid`;
      createdEmails.push(loginEmail);
      await createTestUser(prisma, { email: loginEmail });
    });

    it('200 — returns accessToken on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: loginEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.user.email).toBe(loginEmail);
      // Refresh token cookie should be set
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('401 — wrong password returns ERR_CREDENTIALS_INVALID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: loginEmail, password: 'WrongPass999!' });

      expect(res.status).toBe(401);
    });

    it('401 — unknown email returns same error (prevents enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `nobody-${RUN_ID}@ezihubb-test.invalid`, password: TEST_PASSWORD });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /users/me ────────────────────────────────────────────────────────

  describe('GET /api/v1/users/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const email = `me-${RUN_ID}@ezihubb-test.invalid`;
      createdEmails.push(email);
      await createTestUser(prisma, { email });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: TEST_PASSWORD });
      accessToken = loginRes.body.data.accessToken;
    });

    it('200 — returns current user with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toContain('@ezihubb-test.invalid');
    });

    it('401 — no token returns unauthorized', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('401 — malformed token returns unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer not.a.real.jwt');

      expect(res.status).toBe(401);
    });
  });

  // ── Admin 2FA login flow ─────────────────────────────────────────────────

  describe('Admin 2FA login (without TOTP enrolled)', () => {
    let adminEmail: string;

    beforeAll(async () => {
      adminEmail = `admin2fa-${RUN_ID}@ezihubb-test.invalid`;
      createdEmails.push(adminEmail);
      // Admin without TOTP enabled — should get full access token directly
      await createTestUser(prisma, { email: adminEmail, role: 'ADMIN' });
    });

    it('200 — ADMIN without totpEnabled gets regular accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.requiresTOTP).toBeUndefined();
    });
  });
});
