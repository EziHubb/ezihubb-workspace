import { ExecutionContext, ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request } from 'express';
import { request as nodeRequest } from 'node:http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreContextService } from '../../common/services/store-context.service';
import { AdminEconomicFinancesController } from './admin-economic-finances.controller';
import { AdminFinancesController } from './admin-finances.controller';
import { EconomicFinancesService } from './economic-finances.service';
import { FinancesService } from './finances.service';
import { EconomicRefundsService } from './economic-refunds.service';
import { EconomicRecoveryService } from './economic-recovery.service';
import { EconomicExternalEffectsService } from './economic-external-effects.service';

// Consume every response and close its socket; no undici keep-alive handles left
// behind when Jest/Nx tears down a Windows worker.
function httpRequest(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new Promise<{ status: number; json: () => Promise<unknown> }>((resolve, reject) => {
    const request = nodeRequest(url, { method: options.method ?? 'GET', headers: { ...options.headers, Connection: 'close' }, agent: false }, response => {
      let body = '';
      response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; }); response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode ?? 0, json: async () => JSON.parse(body) }));
    });
    request.on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('Local test HTTP timeout')));
    request.end(options.body);
  });
}

describe('economic finance HTTP authorization and DTO contracts (synthetic identity/provider)', () => {
  let app: INestApplication, origin: string;
  const finances = { overview: jest.fn(async scope => ({ ...scope, availableMinor: '1000' })),
    summary: jest.fn(async scope => ({ ...scope, readOnly: true, legacyIncluded: false })),
    statement: jest.fn(async () => ({ data: [] })), payouts: jest.fn(async () => ({ data: [] })),
    request: jest.fn(async () => ({ state: 'REQUESTED' })), reject: jest.fn(async () => ({ state: 'REJECTED' })),
    settle: jest.fn(async () => ({ state: 'PAID' })),
    reconciliation: jest.fn(async scope => ({ ...scope, readOnly: true, data: [] })) };
  const contexts = {
    resolve: jest.fn(async (req: Request) => {
      const user = req.user as { role: string; sub: string };
      const selected = req.headers['x-store-context'];
      const ownStore = user.sub === 'seller-b' ? 'store-b' : 'store-a';
      if (selected && selected !== ownStore) throw new ForbiddenException('Foreign store');
      return { storeId: user.role === 'SUPER_ADMIN' && !selected ? null : ownStore, isPlatformContext: user.role === 'SUPER_ADMIN' && !selected };
    }),
    requireStoreId: (scope: { storeId: string | null }) => { if (!scope.storeId) throw new ForbiddenException('Choose own store'); return scope.storeId; },
    requirePlatformContext: (scope: { isPlatformContext: boolean }) => { if (!scope.isPlatformContext) throw new ForbiddenException('Platform context required'); },
  };
  const refunds = { options: jest.fn(async () => ({ lines: [] })), prepareShippingOverride: jest.fn(async () => ({ id: 'override' })), prepare: jest.fn(async () => ({ id: 'refund' })), execute: jest.fn(async () => ({ state: 'SUCCEEDED' })), recoverDebt: jest.fn(async () => ({ recoveredMinor: '0' })) };
  const recovery = { list: jest.fn(async () => ({ data: [] })), recover: jest.fn(async () => ({ applied: true })) };
  const external = { list: jest.fn(async () => ({ data: [] })), preparePod: jest.fn(async () => ({ ids: ['effect'], alreadyPrepared: false })), executePod: jest.fn(async () => ({ id: 'effect', state: 'SUCCEEDED' })) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AdminEconomicFinancesController, AdminFinancesController], providers: [
      { provide: EconomicFinancesService, useValue: finances }, { provide: StoreContextService, useValue: contexts }, { provide: FinancesService, useValue: {} },
      { provide: EconomicRefundsService, useValue: refunds },
      { provide: EconomicRecoveryService, useValue: recovery },
      { provide: EconomicExternalEffectsService, useValue: external },
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<Request>(); const role = req.headers['x-test-role'];
      if (!role) return false;
      req.user = { role, sub: req.headers['x-test-user'] ?? 'seller-a' };
      return true;
    } }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1'); origin = await app.getUrl();
  });
  afterAll(async () => { if (app) await app.close(); });
  beforeEach(() => jest.clearAllMocks());
  const query = 'kind=SELLER&beneficiaryId=store-a&currency=USD&provenance=TEST';
  it('permits shipping exceptions only for platform super admin with server identity and an exact amount plus audit reference', async () => {
    const path = `${origin}/admin/economic-finances/captures/capture/shipping-refund-override?provenance=TEST`;
    const headers = { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN', 'x-test-user': 'operator' };
    const payload = { partKey: 'shipping:shop', amountMinor: '125', reason: 'Separate approval', evidenceReference: 'case-1', idempotencyKey: 'key' };
    for (const role of ['', 'ADMIN', 'CUSTOMER']) expect((await httpRequest(path, { method: 'POST', headers: { ...headers, 'x-test-role': role }, body: JSON.stringify(payload) })).status).toBe(403);
    expect((await httpRequest(path, { method: 'POST', headers: { ...headers, 'x-store-context': 'store-a' }, body: JSON.stringify(payload) })).status).toBe(403);
    for (const extra of [{ amountMinor: 125 }, { amountMinor: '1.25' }, { amountMinor: '0' }, { amountMinor: '01' }, { evidenceReference: '' }, { actorId: 'forged' }, { verified: true }, { approveGiftWrap: true }, { selection: [] }]) {
      expect((await httpRequest(path, { method: 'POST', headers, body: JSON.stringify({ ...payload, ...extra }) })).status).toBe(400);
    }
    expect(refunds.prepareShippingOverride).not.toHaveBeenCalled();
    expect((await httpRequest(path, { method: 'POST', headers, body: JSON.stringify(payload) })).status).toBe(201);
    expect(refunds.prepareShippingOverride).toHaveBeenCalledWith('capture', 'operator', 'TEST', expect.objectContaining(payload));
  });
  it('fences external effects to platform super admin and never accepts actor, payload, endpoint or verified proof', async () => {
    const prefix = `${origin}/admin/economic-finances/`, headers = { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN', 'x-test-user': 'operator' };
    for (const role of ['', 'ADMIN', 'CUSTOMER']) {
      expect((await httpRequest(`${prefix}external-effects`, { headers: role ? { 'x-test-role': role } : {} })).status).toBe(403);
      expect((await httpRequest(`${prefix}store-orders/shop/pod-intents`, { method: 'POST', headers: { ...headers, 'x-test-role': role }, body: '{"reason":"Audit"}' })).status).toBe(403);
    }
    expect((await httpRequest(`${prefix}external-effects`, { headers: { ...headers, 'x-store-context': 'store-a' } })).status).toBe(403);
    for (const filters of ['kind=EMAIL', 'currency=EUR', 'provenance=UNKNOWN', 'limit=200', 'recipient=foreign']) {
      expect((await httpRequest(`${prefix}external-effects?${filters}`, { headers })).status).toBe(400);
    }
    for (const body of [{ reason: 'Audit', actorId: 'forged' }, { reason: 'Audit', payload: {} }, { reason: 'Audit', verified: true }]) {
      expect((await httpRequest(`${prefix}store-orders/shop/pod-intents?provenance=LIVE`, { method: 'POST', headers, body: JSON.stringify(body) })).status).toBe(400);
    }
    for (const body of [{ reference: 'https://evil.test' }, { reference: 'original', verified: true }, { endpoint: '/replace' }]) {
      expect((await httpRequest(`${prefix}external-effects/effect/execute-pod?provenance=LIVE`, { method: 'POST', headers, body: JSON.stringify(body) })).status).toBe(400);
    }
    expect(external.preparePod).not.toHaveBeenCalled(); expect(external.executePod).not.toHaveBeenCalled();
    expect((await httpRequest(`${prefix}store-orders/shop/pod-intents?provenance=LIVE`, { method: 'POST', headers, body: '{"reason":"Original verified shop"}' })).status).toBe(201);
    expect(external.preparePod).toHaveBeenCalledWith('shop', 'operator', 'LIVE', 'Original verified shop');
    expect((await httpRequest(`${prefix}external-effects/effect/execute-pod?provenance=LIVE`, { method: 'POST', headers, body: '{"reference":"original"}' })).status).toBe(201);
    expect(external.executePod).toHaveBeenCalledWith('effect', 'LIVE', 'original');
  });
  it('requires platform super admin and an audit reason for DB-only lifecycle recovery', async () => {
    const path = `${origin}/admin/economic-finances/outbox/event/recover-lifecycle?provenance=TEST`;
    for (const role of ['', 'ADMIN', 'CUSTOMER']) {
      expect((await httpRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
        body: JSON.stringify({ reason: 'Original inventory restored' }) })).status).toBe(403);
    }
    const headers = { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN', 'x-test-user': 'operator' };
    expect((await httpRequest(path, { method: 'POST', headers: { ...headers, 'x-store-context': 'store-a' }, body: '{"reason":"Audit"}' })).status).toBe(403);
    for (const body of [{}, { reason: 'Audit', verified: true }, { reason: 'Audit', resetAttempts: true }, { reason: 'Audit', amountMinor: '100' }]) {
      expect((await httpRequest(path, { method: 'POST', headers, body: JSON.stringify(body) })).status).toBe(400);
    }
    expect(recovery.recover).not.toHaveBeenCalled();
    expect((await httpRequest(path, { method: 'POST', headers, body: '{"reason":"Original inventory restored"}' })).status).toBe(201);
    expect(recovery.recover).toHaveBeenCalledWith('event', 'operator', 'TEST', 'Original inventory restored');
  });
  it('protects the evidence summary with platform-only RBAC and rejects mixed or supplied proof scopes', async () => {
    const path = `${origin}/admin/economic-finances/summary`;
    for (const role of ['', 'ADMIN', 'CUSTOMER']) {
      expect((await httpRequest(path, { headers: role ? { 'x-test-role': role } : {} })).status).toBe(403);
    }
    expect((await httpRequest(path, { headers: { 'x-test-role': 'SUPER_ADMIN', 'x-store-context': 'store-a' } })).status).toBe(403);
    for (const filters of ['provenance=UNKNOWN', 'currency=EUR', 'verified=true', 'storeId=foreign']) {
      expect((await httpRequest(`${path}?${filters}`, { headers: { 'x-test-role': 'SUPER_ADMIN' } })).status).toBe(400);
    }
    expect(finances.summary).not.toHaveBeenCalled();
    expect((await httpRequest(`${path}?provenance=TEST`, { headers: { 'x-test-role': 'SUPER_ADMIN' } })).status).toBe(200);
    expect(finances.summary).toHaveBeenCalledWith({ currency: 'USD', provenance: 'TEST' });
  });
  it('restricts original refund options to scoped platform super admins, even while writes are disabled', async () => {
    const path = `${origin}/admin/economic-finances/captures/capture/refund-options?provenance=TEST`;
    for (const role of ['', 'ADMIN', 'CUSTOMER']) {
      expect((await httpRequest(path, { headers: role ? { 'x-test-role': role } : {} })).status).toBe(403);
    }
    expect((await httpRequest(path, { headers: { 'x-test-role': 'SUPER_ADMIN', 'x-store-context': 'store-a' } })).status).toBe(403);
    expect(refunds.options).not.toHaveBeenCalled();
    expect((await httpRequest(path, { headers: { 'x-test-role': 'SUPER_ADMIN' } })).status).toBe(200);
    expect(refunds.options).toHaveBeenCalledWith('capture', 'TEST');
  });
  it('restricts refund and debt writes to platform super admins and authenticated actors', async () => {
    const headers = { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN', 'x-test-user': 'operator' };
    for (const path of ['captures/capture/refund-requests', 'refund-requests/refund/execute', 'debt/recover']) {
      for (const role of ['', 'CUSTOMER', 'ADMIN']) {
        expect((await httpRequest(`${origin}/admin/economic-finances/${path}?${query}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: '{}',
        })).status).toBe(403);
      }
      expect((await httpRequest(`${origin}/admin/economic-finances/${path}?${path === 'debt/recover' ? query : 'provenance=TEST'}`, {
        method: 'POST', headers: { ...headers, 'x-store-context': 'store-a' },
        body: JSON.stringify(path.startsWith('captures') ? { reason: 'Return', idempotencyKey: 'key', selection: [{ partKey: 'item:line', quantity: 1 }] } : {}),
      })).status).toBe(403);
    }
    expect(refunds.prepare).not.toHaveBeenCalled(); expect(refunds.execute).not.toHaveBeenCalled(); expect(refunds.recoverDebt).not.toHaveBeenCalled();
    const response = await httpRequest(`${origin}/admin/economic-finances/captures/capture/refund-requests?provenance=TEST`, {
      method: 'POST', headers, body: JSON.stringify({ reason: 'Return', idempotencyKey: 'request', selection: [{ partKey: 'item:line', quantity: 1 }] }),
    });
    expect(response.status).toBe(201);
    expect(refunds.prepare).toHaveBeenCalledWith('capture', 'operator', 'TEST', expect.objectContaining({ selection: [{ partKey: 'item:line', quantity: 1 }] }));
  });
  it('rejects supplied refund amounts, provider account, evidence and malformed quantities', async () => {
    const headers = { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN' };
    for (const payload of [{ amountMinor: '100', verified: true }, { providerAccount: 'foreign' }, { reference: 'https://evil.test/refund' }]) {
      expect((await httpRequest(`${origin}/admin/economic-finances/refund-requests/refund/execute?provenance=TEST`, {
        method: 'POST', headers, body: JSON.stringify(payload),
      })).status).toBe(400);
    }
    for (const quantity of [0, -1, 1.5, '1']) {
      expect((await httpRequest(`${origin}/admin/economic-finances/captures/capture/refund-requests?provenance=TEST`, {
        method: 'POST', headers, body: JSON.stringify({ reason: 'Return', idempotencyKey: 'key', selection: [{ partKey: 'item:line', quantity }] }),
      })).status).toBe(400);
    }
    expect(refunds.execute).not.toHaveBeenCalled(); expect(refunds.prepare).not.toHaveBeenCalled();
  });
  it('accepts only a boolean separate gift wrap approval from the platform super admin, never supplied actor/proof', async () => {
    const path = `${origin}/admin/economic-finances/captures/capture/refund-requests?provenance=TEST`;
    const body = { reason: 'Separate gift wrap approval', idempotencyKey: 'gift-wrap', approveGiftWrap: true,
      selection: [{ partKey: 'gift-wrap:original-shop', quantity: 1 }] };
    for (const payload of [{ ...body, approveGiftWrap: 'true' }, { ...body, giftWrapApproval: { approvedBy: 'foreign' } }, { ...body, actorId: 'foreign' }]) {
      expect((await httpRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN' }, body: JSON.stringify(payload) })).status).toBe(400);
    }
    expect((await httpRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': 'ADMIN' }, body: JSON.stringify(body) })).status).toBe(403);
    expect(refunds.prepare).not.toHaveBeenCalled();
    expect((await httpRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN', 'x-test-user': 'operator' }, body: JSON.stringify(body) })).status).toBe(201);
    expect(refunds.prepare).toHaveBeenCalledWith('capture', 'operator', 'TEST', expect.objectContaining({ approveGiftWrap: true }));
  });
  it('restricts reconciliation to super admins in platform context', async () => {
    const path = `${origin}/admin/economic-finances/reconciliation?provenance=TEST`;
    for (const role of ['', 'CUSTOMER', 'ADMIN']) {
      expect((await httpRequest(path, { headers: role ? { 'x-test-role': role } : {} })).status).toBe(403);
    }
    expect((await httpRequest(path, { headers: { 'x-test-role': 'SUPER_ADMIN', 'x-store-context': 'store-a' } })).status).toBe(403);
    expect(finances.reconciliation).not.toHaveBeenCalled();
    const result = await httpRequest(`${path}&kind=REFUND&storeId=store-a&reference=EZH-fixture&page=2&limit=10`, {
      headers: { 'x-test-role': 'SUPER_ADMIN' },
    });
    expect(result.status).toBe(200);
    expect(finances.reconciliation).toHaveBeenCalledWith(expect.objectContaining({
      provenance: 'TEST', currency: 'USD', kind: 'REFUND', storeId: 'store-a', reference: 'EZH-fixture', page: 2, limit: 10,
    }));
  });
  it('rejects invalid reconciliation filters and supplied proof fields before querying', async () => {
    for (const queryString of ['limit=200', 'page=0', 'provenance=UNKNOWN', 'currency=EUR', 'state=UNKNOWN',
      'kind=SELLER', 'reference=', 'verified=true', 'amountMinor=100']) {
      expect((await httpRequest(`${origin}/admin/economic-finances/reconciliation?${queryString}`, {
        headers: { 'x-test-role': 'SUPER_ADMIN' },
      })).status).toBe(400);
    }
    expect(finances.reconciliation).not.toHaveBeenCalled();
  });
  it('rejects anonymous and seller attempts to verify a platform settlement', async () => {
    for (const role of ['', 'CUSTOMER', 'ADMIN']) {
      const result = await httpRequest(`${origin}/admin/economic-finances/payouts/payout/verify-settlement?${query}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: JSON.stringify({ reference: 'tr_fixture' }),
      });
      expect(result.status).toBe(403);
    }
    expect(finances.settle).not.toHaveBeenCalled();
  });
  it('requires platform context and forwards authenticated actor plus exact scope, never pagination as Prisma scope', async () => {
    const path = `${origin}/admin/economic-finances/payouts/payout/verify-settlement?${query}&limit=10&page=2`;
    const payload = { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN' }, body: JSON.stringify({ reference: 'tr_fixture' }) };
    expect((await httpRequest(path, { ...payload, headers: { ...payload.headers, 'x-store-context': 'store-a' } })).status).toBe(403);
    expect((await httpRequest(path, payload)).status).toBe(201);
    expect(finances.settle).toHaveBeenCalledWith('payout', 'seller-a', 'tr_fixture', {
      kind: 'SELLER', beneficiaryId: 'store-a', currency: 'USD', provenance: 'TEST',
    });
  });
  it('validates mode/currency/page bounds and never accepts client-supplied recipient/proof', async () => {
    const headers = { 'Content-Type': 'application/json', 'x-test-role': 'SUPER_ADMIN' };
    for (const extra of ['&limit=200', '&page=0', '&provenance=UNKNOWN', '&currency=EUR']) {
      expect((await httpRequest(`${origin}/admin/economic-finances/payouts?${query}${extra}`, { headers })).status).toBe(400);
    }
    expect((await httpRequest(`${origin}/admin/economic-finances/payouts/payout/verify-settlement?${query}`, { method: 'POST', headers,
      body: JSON.stringify({ reference: 'tr_fixture', amountMinor: '1', verified: true }) })).status).toBe(400);
    expect(finances.settle).not.toHaveBeenCalled();
  });
  it('scopes each seller overview to the authenticated store and refuses foreign switching', async () => {
    const headers = { 'x-test-role': 'ADMIN', 'x-test-user': 'seller-b' };
    const path = `${origin}/admin/finances/economic/overview?provenance=TEST`;
    const response = await httpRequest(path, { headers }); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ beneficiaryId: 'store-b', provenance: 'TEST' });
    expect((await httpRequest(path, { headers: { ...headers, 'x-store-context': 'store-a' } })).status).toBe(403);
    expect((await httpRequest(`${path}&beneficiaryId=store-a`, { headers })).status).toBe(400);
  });
});
