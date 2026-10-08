import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { request } from 'node:https';
import { randomBytes, createHash } from 'node:crypto';
import { IncomingHttpHeaders } from 'node:http';
import { createRequire } from 'node:module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { TotpService } from '../auth/totp.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from '../auth/strategies/jwt-refresh.strategy';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { PaypalService } from './paypal.service';
import { OrderPayerService } from './order-payer.service';
import { EconomicWebhookRetryException } from './economic-webhook-retry.exception';
import { apiCorsOptions } from '../../common/utils/api-cors-options';
import { StoreContextService } from '../../common/services/store-context.service';
import { AdminEconomicFinancesController } from '../finances/admin-economic-finances.controller';
import { EconomicFinancesService } from '../finances/economic-finances.service';
import { EconomicRefundsService } from '../finances/economic-refunds.service';
import { EconomicRecoveryService } from '../finances/economic-recovery.service';
import { EconomicExternalEffectsService } from '../finances/economic-external-effects.service';

const { createLoopbackCertificate } = createRequire(__filename)('../../../../../scripts/m5/tls.cjs');
jest.mock('../auth/totp.service', () => ({ TotpService: class {} }));
jest.mock('../messages/messages.service', () => ({ MessagesService: class {} }));

// REAL TLS/Nest/controller/Passport/JWT/signature boundaries; SYNTHETIC storage,
// auth login and provider handlers. No AppModule, native DB, browser or provider
// delivery claim. Keep raw credentials, bodies and signatures out of artifacts.
describe('M5.3 HTTPS boundary contracts (synthetic storage/provider)', () => {
  let app: INestApplication, origin: string, cert: string;
  const secret = randomBytes(32).toString('hex'), webhookSecret = `whsec_${randomBytes(32).toString('hex')}`;
  const jwt = new JwtService();
  const stripe = new Stripe('sk_test_m5_synthetic_no_network');
  const user = { id: 'm5-user', role: 'SUPER_ADMIN', deletedAt: null, sessionsRevokedAt: null as Date | null,
    authSessions: [{ id: 'session' }], storeId: 'm5-owned-store' };
  const expiresAt = new Date(Date.now() + 60_000);
  const refreshToken = randomBytes(40).toString('hex');
  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
  const prisma = { user: { findUnique: jest.fn(async () => user) }, refreshToken: { findFirst: jest.fn(async () => ({
    id: 'refresh', userId: user.id, tokenHash, user, expiresAt, revokedAt: null,
  })) } };
  const config = { get: (key: string) => ({ 'jwt.accessSecret': secret, 'app.env': 'production',
    NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_m5_synthetic_no_network', STRIPE_WEBHOOK_SECRET: webhookSecret }[key]) };
  const auth = { refreshTokens: jest.fn(async (_id, _old, res) => {
    AuthService.prototype.setRefreshTokenCookie.call({ config } as never, res, 'synthetic-successor');
    return { accessToken: 'synthetic-successor-access' };
  }), clearRefreshTokenCookie: (res: never) => AuthService.prototype.clearRefreshTokenCookie.call({} as never, res),
  revokeSession: jest.fn(async () => undefined) };
  const payments = { getStats: jest.fn(async () => ({ synthetic: true })), handleStripeWebhook: jest.fn(async () => undefined),
    handlePaypalWebhookEvent: jest.fn(async () => undefined) };
  const paypal = { verifyWebhookSignature: jest.fn(async () => false) };
  const refunds = { prepare: jest.fn(async () => ({ id: 'm5-synthetic-refund' })),
    prepareShippingOverride: jest.fn(async () => ({ id: 'm5-synthetic-approval' })) };
  const previous: Record<string, string | undefined> = {};

  function sign(payload: Record<string, unknown> = {}, signingSecret = secret, expiresIn = 60) {
    return jwt.sign({ sub: user.id, email: 'm5@ezihubb.test', role: user.role, sid: 'session', ...payload },
      { secret: signingSecret, expiresIn });
  }
  function send(path: string, options: { method?: string; headers?: Record<string, string>; body?: string; ca?: string } = {}) {
    return new Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const req = request(`${origin}/api/v1/${path}`, { method: options.method ?? 'GET', ca: options.ca ?? cert,
        rejectUnauthorized: true, agent: false, headers: { Connection: 'close', ...options.headers } }, res => {
        let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; });
        res.on('error', reject); res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      });
      req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('M5_HTTPS_TIMEOUT'))); req.end(options.body);
    });
  }
  beforeAll(async () => {
    for (const key of ['CORS_ORIGINS', 'APP_URL', 'ADMIN_URL']) previous[key] = process.env[key];
    process.env.CORS_ORIGINS = 'https://client.ezihubb.test,https://admin.ezihubb.test';
    process.env.APP_URL = 'https://client.ezihubb.test'; process.env.ADMIN_URL = 'https://admin.ezihubb.test';
    const module = await Test.createTestingModule({ imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AuthController, PaymentsController, WebhooksController, AdminEconomicFinancesController], providers: [JwtStrategy, JwtRefreshStrategy, StoreContextService,
        { provide: ConfigService, useValue: config }, { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth }, { provide: TotpService, useValue: {} },
        { provide: AuditLogService, useValue: { log: jest.fn() } }, { provide: PaymentsService, useValue: payments },
        { provide: PaypalService, useValue: paypal }, { provide: OrderPayerService, useValue: {} },
        { provide: EconomicFinancesService, useValue: {} }, { provide: EconomicRefundsService, useValue: refunds },
        { provide: EconomicRecoveryService, useValue: {} }, { provide: EconomicExternalEffectsService, useValue: {} },
      ] }).compile();
    const tls = createLoopbackCertificate(); cert = tls.cert;
    app = module.createNestApplication({ rawBody: true, httpsOptions: tls, logger: false });
    app.setGlobalPrefix('api/v1'); app.use(cookieParser()); app.use(helmet());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableCors(apiCorsOptions());
    await app.listen(0, '127.0.0.1'); origin = await app.getUrl();
  });
  afterAll(async () => {
    if (app) await app.close();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  beforeEach(() => {
    jest.clearAllMocks(); user.role = 'SUPER_ADMIN'; user.deletedAt = null; user.sessionsRevokedAt = null;
    user.authSessions = [{ id: 'session' }]; prisma.user.findUnique.mockResolvedValue(user);
    prisma.refreshToken.findFirst.mockResolvedValue({ id: 'refresh', userId: user.id, tokenHash, user, expiresAt, revokedAt: null });
  });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  it('trusts only the ephemeral certificate and actually listens on HTTPS', async () => {
    expect(origin).toMatch(/^https:\/\/127\.0\.0\.1:\d+$/);
    expect((await send('payments/stats', { headers: bearer(sign()) })).status).toBe(200);
    await expect(send('payments/stats', { ca: createLoopbackCertificate().cert })).rejects.toMatchObject({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  });
  it.each(['missing', 'wrong-secret', 'expired', 'totp-challenge', 'forged-role-header'])(
    'rejects %s before calling the financial reader', async variant => {
      const tokens: Record<string, string | undefined> = { missing: undefined, 'wrong-secret': sign({}, 'wrong-secret'),
        expired: sign({}, secret, -1), 'totp-challenge': sign({ purpose: 'totp' }), 'forged-role-header': undefined };
      const token = tokens[variant];
      const result = await send('payments/stats', { headers: { ...(token ? bearer(token) : {}), 'x-test-role': 'SUPER_ADMIN' } });
      expect(result.status).toBe(401); expect(payments.getStats).not.toHaveBeenCalled();
    });
  it.each(['CUSTOMER', 'ADMIN'])('rejects a real signed %s JWT at the platform boundary', async role => {
    user.role = role;
    expect((await send('payments/stats', { headers: bearer(sign()) })).status).toBe(403);
    expect(payments.getStats).not.toHaveBeenCalled();
  });
  it.each(['deleted', 'revoked-session', 'changed-role', 'legacy-revoked'])('rejects %s after signature verification', async state => {
    const token = sign(state === 'legacy-revoked' ? { sid: undefined } : {});
    if (state === 'deleted') prisma.user.findUnique.mockResolvedValue({ ...user, deletedAt: new Date() } as never);
    if (state === 'revoked-session') user.authSessions = [];
    if (state === 'changed-role') user.role = 'CUSTOMER';
    if (state === 'legacy-revoked') user.sessionsRevokedAt = new Date();
    expect((await send('payments/stats', { headers: bearer(token) })).status).toBe(401);
    expect(payments.getStats).not.toHaveBeenCalled();
  });
  it('includes credentialed CORS only for configured first-party origins', async () => {
    const allowed = await send('payments/stats', { headers: { ...bearer(sign()), Origin: 'https://client.ezihubb.test' } });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://client.ezihubb.test');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await send('payments/stats', { headers: { ...bearer(sign()), Origin: 'https://attacker.test' } });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
  it.each(['https://attacker.test', 'https://client.ezihubb.test.attacker.test', 'null'])(
    'blocks cookie refresh CSRF from %s before rotating', async value => {
      expect((await send('auth/refresh', { method: 'POST', headers: { Cookie: `refresh_token=${refreshToken}`, Origin: value } })).status).toBe(403);
      expect(auth.refreshTokens).not.toHaveBeenCalled();
    });
  it('checks Referer fallback and rejects invalid refresh cookies before rotating', async () => {
    expect((await send('auth/refresh', { method: 'POST', headers: { Cookie: `refresh_token=${refreshToken}`, Referer: 'https://attacker.test/path' } })).status).toBe(403);
    prisma.refreshToken.findFirst.mockResolvedValue(null as never);
    expect((await send('auth/refresh', { method: 'POST', headers: { Cookie: 'refresh_token=invalid', Origin: 'https://client.ezihubb.test' } })).status).toBe(401);
    expect(auth.refreshTokens).not.toHaveBeenCalled();
  });
  it('emits the production HttpOnly/Secure/SameSite cookie at the auth path', async () => {
    const result = await send('auth/refresh', { method: 'POST', headers: { Cookie: `refresh_token=${refreshToken}`, Origin: 'https://admin.ezihubb.test' } });
    expect(result.status).toBe(200); expect(auth.refreshTokens).toHaveBeenCalledWith(user.id, refreshToken, expect.anything());
    const cookie = result.headers['set-cookie']?.[0] ?? '';
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=None', 'Path=/api/v1/auth']) expect(cookie).toContain(attribute);
    expect(result.headers['strict-transport-security']).toBeDefined();
  });
  const event = JSON.stringify({ id: 'evt_m5_synthetic', type: 'payment_intent.succeeded', livemode: false,
    data: { object: { id: 'pi_m5_synthetic' } } }, null, 2);
  function signature(payload = event, timestamp = Math.floor(Date.now() / 1000)) {
    return stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret, timestamp });
  }
  it('verifies the actual Stripe SDK signature over the original raw HTTPS body', async () => {
    const result = await send('webhooks/stripe', { method: 'POST', body: event,
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature() } });
    expect(result.status).toBe(200); expect(payments.handleStripeWebhook).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt_m5_synthetic', livemode: false }));
  });
  it.each(['missing', 'tampered', 'stale', 'reserialized'])('rejects %s Stripe evidence before the handler', async variant => {
    const body = variant === 'tampered' ? event.replace('pi_m5_synthetic', 'pi_changed')
      : variant === 'reserialized' ? JSON.stringify(JSON.parse(event)) : event;
    const result = await send('webhooks/stripe', { method: 'POST', body,
      headers: { 'Content-Type': 'application/json', ...(variant === 'missing' ? {} : { 'Stripe-Signature': signature(event, variant === 'stale' ? 1 : undefined) }) } });
    expect(result.status).toBe(401); expect(payments.handleStripeWebhook).not.toHaveBeenCalled();
  });
  it('preserves retryable versioned Stripe failure instead of acknowledging it', async () => {
    payments.handleStripeWebhook.mockRejectedValueOnce(new EconomicWebhookRetryException());
    expect((await send('webhooks/stripe', { method: 'POST', body: event,
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature() } })).status).toBe(503);
  });
  const paypalBody = JSON.stringify({ id: 'WH-m5-synthetic', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'm5-synthetic' } });
  it('does not process an unverified PayPal event (acknowledgement is not settlement)', async () => {
    expect((await send('webhooks/paypal', { method: 'POST', body: paypalBody, headers: { 'Content-Type': 'application/json' } })).status).toBe(200);
    expect(paypal.verifyWebhookSignature).toHaveBeenCalledWith(expect.anything(), paypalBody);
    expect(payments.handlePaypalWebhookEvent).not.toHaveBeenCalled();
  });
  it('preserves retryable versioned PayPal failure after modeled verification', async () => {
    paypal.verifyWebhookSignature.mockResolvedValueOnce(true);
    payments.handlePaypalWebhookEvent.mockRejectedValueOnce(new EconomicWebhookRetryException());
    expect((await send('webhooks/paypal', { method: 'POST', body: paypalBody, headers: { 'Content-Type': 'application/json' } })).status).toBe(503);
  });
  const refundPath = 'admin/economic-finances/captures/m5-capture/refund-requests?provenance=TEST';
  const refundBody = { idempotencyKey: 'm5-refund-request', reason: 'Separate approval', selection: [{ partKey: 'wrap:m5-shop', quantity: 1 }], approveGiftWrap: true };
  it.each(['CUSTOMER', 'ADMIN'])('denies gift-wrap approval by a signed %s, not a test role header', async role => {
    user.role = role;
    expect((await send(refundPath, { method: 'POST', body: JSON.stringify(refundBody),
      headers: { ...bearer(sign()), 'Content-Type': 'application/json' } })).status).toBe(403);
    expect(refunds.prepare).not.toHaveBeenCalled();
  });
  it.each(['m5-owned-store', 'm5-foreign-store'])('denies platform approval while selecting %s', async store => {
    expect((await send(refundPath, { method: 'POST', body: JSON.stringify(refundBody),
      headers: { ...bearer(sign()), 'Content-Type': 'application/json', 'X-Store-Context': store } })).status).toBe(403);
    expect(refunds.prepare).not.toHaveBeenCalled();
  });
  it('rejects forged actor and verified evidence fields before the refund service', async () => {
    for (const extra of [{ actorId: 'forged' }, { approvedBy: 'forged' }, { verified: true }]) {
      expect((await send(refundPath, { method: 'POST', body: JSON.stringify({ ...refundBody, ...extra }),
        headers: { ...bearer(sign()), 'Content-Type': 'application/json' } })).status).toBe(400);
    }
    expect(refunds.prepare).not.toHaveBeenCalled();
  });
  it('derives a separate gift-wrap approver from the verified platform JWT', async () => {
    expect((await send(refundPath, { method: 'POST', body: JSON.stringify(refundBody),
      headers: { ...bearer(sign()), 'Content-Type': 'application/json' } })).status).toBe(201);
    expect(refunds.prepare).toHaveBeenCalledWith('m5-capture', user.id, 'TEST', expect.objectContaining(refundBody));
  });
  it('passes exact separately approved shipping money and authenticated actor to the service', async () => {
    const body = { partKey: 'shipping:m5-shop', amountMinor: '125', reason: 'Separate approval', evidenceReference: 'm5-case', idempotencyKey: 'm5-shipping-key' };
    expect((await send('admin/economic-finances/captures/m5-capture/shipping-refund-override?provenance=TEST',
      { method: 'POST', body: JSON.stringify(body), headers: { ...bearer(sign()), 'Content-Type': 'application/json' } })).status).toBe(201);
    expect(refunds.prepareShippingOverride).toHaveBeenCalledWith('m5-capture', user.id, 'TEST', expect.objectContaining(body));
  });
  it('retains CORS preflight headers and disallows wildcard production configuration', async () => {
    const result = await send('auth/refresh', { method: 'OPTIONS', headers: { Origin: 'https://client.ezihubb.test',
      'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-store-context' } });
    expect(result.status).toBe(204); expect(result.headers['access-control-max-age']).toBe('86400');
    expect(result.headers['access-control-allow-headers']).toContain('X-Store-Context');
    const oldOrigins = process.env.CORS_ORIGINS, oldNode = process.env.NODE_ENV;
    try { process.env.CORS_ORIGINS = '*'; process.env.NODE_ENV = 'production'; expect(apiCorsOptions).toThrow('not allowed in production'); }
    finally { process.env.CORS_ORIGINS = oldOrigins; process.env.NODE_ENV = oldNode; }
  });
});
