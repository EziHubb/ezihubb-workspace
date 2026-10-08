import 'reflect-metadata';
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Request } from 'express';
import { request as nodeRequest } from 'node:http';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PdfService } from '../pdf/pdf.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { checkoutIdentity } from './checkout-request';

// PDF rendering is unrelated to this HTTP contract and its package is ESM-only.
jest.mock('../pdf/pdf.service', () => ({ PdfService: class PdfService {} }));

function localRequest(url: string, headers: Record<string, string> = {}, body?: unknown) {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const req = nodeRequest(url, { method: body === undefined ? 'GET' : 'POST', agent: false,
      headers: { ...headers, 'Content-Type': 'application/json', Connection: 'close' } }, res => {
      let value = ''; res.setEncoding('utf8'); res.on('data', chunk => { value += chunk; });
      res.on('error', reject); res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(value) }));
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Local synthetic HTTP timeout')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
describe('checkout HTTP request contract and actor/cookie scoping (synthetic auth)', () => {
  let app: INestApplication, origin: string;
  const key = 'synthetic-original-request';
  const records = [checkoutIdentity(key, 'buyer'), checkoutIdentity(key, undefined, 'guest-cart')]
    .map((identity, index) => ({ ...identity, orderId: `original-${index}`, orderNumber: `EZH-${index}`,
      paymentRequired: false, initialStatus: 'CONFIRMED', totalMinor: 1549n }));
  const create = jest.fn(async () => ({ orderId: 'new' }));
  const orderRead = jest.fn(async () => ({ status: 'CONFIRMED', adminArchivedAt: null }));
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, { onlinePaymentsEnabled: false, checkout: create,
    prisma: { checkoutRequest: { findUnique: ({ where }: { where: { identityHash: string } }) => records.find(record => record.identityHash === where.identityHash) ?? null },
      order: { findUnique: orderRead } } });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [OrdersController], providers: [
      { provide: OrdersService, useValue: service }, { provide: PdfService, useValue: {} },
    ] }).overrideGuard(OptionalAuthGuard).useValue({ canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<Request>();
      if (req.headers['x-synthetic-user']) req.user = { sub: req.headers['x-synthetic-user'] };
      return true;
    } }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => false }).compile();
    app = module.createNestApplication(); app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1'); origin = await app.getUrl();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { create.mockClear(); orderRead.mockClear(); });
  it('returns only public capability metadata, without payment credentials', async () => {
    expect(await localRequest(`${origin}/orders/checkout-capabilities`)).toEqual({ status: 200,
      body: { version: 'checkout-v1', onlinePaymentsAvailable: false, orderRequestsAvailable: true } });
  });
  it('recovers an original response for its authenticated actor only', async () => {
    const path = `${origin}/orders/checkout-requests/${key}`;
    expect((await localRequest(path, { 'x-synthetic-user': 'buyer' })).body).toMatchObject({ orderId: 'original-0', total: 15.49 });
    orderRead.mockClear();
    expect((await localRequest(path, { 'x-synthetic-user': 'other' })).status).toBe(404);
    expect(orderRead).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  });
  it('uses the guest cart cookie, never a query-supplied email or user identity', async () => {
    const path = `${origin}/orders/checkout-requests/${key}`;
    expect((await localRequest(path, { Cookie: 'cart_session=guest-cart' })).body).toMatchObject({ orderId: 'original-1' });
    expect((await localRequest(`${path}?userId=buyer&email=synthetic@example.test`)).status).toBe(400);
    expect((await localRequest(path, { Cookie: 'cart_session=other-cart' })).status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });
  it('requires the new opaque request identity and rejects client-supplied actors or payment proof', async () => {
    for (const body of [{}, { idempotencyKey: 'short' }, { idempotencyKey: key, userId: 'buyer' },
      { idempotencyKey: key, paymentRequired: false }, { idempotencyKey: key, total: 0 }]) {
      expect((await localRequest(`${origin}/orders`, {}, body)).status).toBe(400);
    }
    expect(create).not.toHaveBeenCalled();
    expect((await localRequest(`${origin}/orders`, { Cookie: 'cart_session=guest-cart' },
      { idempotencyKey: key, guestEmail: 'synthetic@example.test' })).status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: key }), undefined, 'guest-cart', { cart_session: 'guest-cart' });
  });
});
