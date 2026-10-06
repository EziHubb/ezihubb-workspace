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
    statement: jest.fn(async () => ({ data: [] })), payouts: jest.fn(async () => ({ data: [] })),
    request: jest.fn(async () => ({ state: 'REQUESTED' })), reject: jest.fn(async () => ({ state: 'REJECTED' })),
    settle: jest.fn(async () => ({ state: 'PAID' })) };
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
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AdminEconomicFinancesController, AdminFinancesController], providers: [
      { provide: EconomicFinancesService, useValue: finances }, { provide: StoreContextService, useValue: contexts }, { provide: FinancesService, useValue: {} },
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
