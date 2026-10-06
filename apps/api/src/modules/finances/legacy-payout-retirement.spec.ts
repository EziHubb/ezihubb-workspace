import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request as httpRequest } from 'node:http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreContextService } from '../../common/services/store-context.service';
import { AffiliatesController } from '../affiliates/affiliates.controller';
import { AdminAffiliatesController } from '../affiliates/admin-affiliates.controller';
import { AffiliateTrackingService } from '../affiliates/affiliate-tracking.service';
import { PortalService } from '../affiliates/portal.service';
import { AdminAffiliatesService } from '../affiliates/admin-affiliates.service';
import { AdminSellerPayoutsController } from '../stores/admin-stores.controller';
import { SellerPayoutsController } from '../stores/seller-orders.controller';
import { StoreOwnerGuard } from '../stores/guards/store-owner.guard';
import { StoreOrdersService } from '../stores/store-orders.service';
import { StoresService } from '../stores/stores.service';
import { EconomicFinancesService } from './economic-finances.service';

describe('legacy payout routes are read-only over HTTP', () => {
  let app: INestApplication, origin: string;
  const write = jest.fn();
  const read = jest.fn(async () => []);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AffiliatesController, AdminAffiliatesController, AdminSellerPayoutsController, SellerPayoutsController],
      providers: [
        { provide: PortalService, useValue: { getMyAffiliate: async () => ({ id: 'affiliate', status: 'ACTIVE' }), requestPayout: write, getMyPayouts: read } },
        { provide: AdminAffiliatesService, useValue: { markPayoutPaid: write, rejectPayout: write, listPayouts: read } },
        { provide: StoreOrdersService, useValue: { requestPayout: write, getPayoutHistory: read } },
        { provide: StoresService, useValue: { adminMarkPayoutPaid: write, adminListPayouts: read } },
        { provide: StoreContextService, useValue: { resolve: async () => ({ isPlatformContext: true }) } },
        { provide: AffiliateTrackingService, useValue: {} }, { provide: EconomicFinancesService, useValue: {} },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest();
      if (!req.headers['x-test-role']) return false;
      req.user = { sub: 'fixture-user', role: req.headers['x-test-role'] }; return true;
    } }).overrideGuard(StoreOwnerGuard).useValue({ canActivate: (ctx: ExecutionContext) => {
      ctx.switchToHttp().getRequest().store = { id: 'fixture-store' }; return true;
    } }).compile();
    app = module.createNestApplication(); await app.listen(0, '127.0.0.1'); origin = await app.getUrl();
  });
  afterAll(async () => { if (app) await app.close(); });
  beforeEach(() => jest.clearAllMocks());
  function call(path: string, method: string, role = 'SUPER_ADMIN') {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = httpRequest(`${origin}${path}`, { method, agent: false, headers: { Connection: 'close', ...(role ? { 'x-test-role': role } : {}) } }, res => {
        let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; }); res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Synthetic HTTP timeout'))); req.end();
    });
  }
  it.each(['/seller/payouts/request', '/admin/seller-payouts/p/pay', '/affiliates/me/payouts', '/admin/affiliates/payouts/p/pay', '/admin/affiliates/payouts/p/reject'])('retires %s without calling money services', async path => {
    const result = await call(path, 'POST');
    expect(result.status).toBe(410); expect(result.body).toContain('ERR_LEGACY_PAYOUT_RETIRED'); expect(write).not.toHaveBeenCalled();
  });
  it('keeps authentication and admin role checks ahead of retirement', async () => {
    expect((await call('/admin/affiliates/payouts/p/pay', 'POST', '')).status).toBe(403);
    expect((await call('/admin/affiliates/payouts/p/pay', 'POST', 'CUSTOMER')).status).toBe(403);
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['/seller/payouts', '/admin/seller-payouts', '/affiliates/me/payouts', '/admin/affiliates/payouts'])('retains historical GET %s', async path => {
    expect((await call(path, 'GET')).status).toBe(200); expect(read).toHaveBeenCalledTimes(1); expect(write).not.toHaveBeenCalled();
  });
});
