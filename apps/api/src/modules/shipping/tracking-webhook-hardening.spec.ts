import { TrackingWebhookController } from './tracking-webhook.controller';
import { createHmac } from 'node:crypto';
import { OrderStatus } from '@prisma/client';
import { ensureFixedOrderProgressSteps } from '../orders/order-progress.defaults';
import { syncOrderStatusFromShops } from '../orders/order-status-sync';
import { TrackingService } from './tracking.service';

jest.mock('../orders/order-progress.defaults', () => ({ ensureFixedOrderProgressSteps: jest.fn().mockResolvedValue([{ id: 'delivered-step', kind: 'DELIVERED' }]) }));
jest.mock('../orders/order-status-sync', () => ({ syncOrderStatusFromShops: jest.fn() }));

describe('Tracking webhook trust boundary', () => {
  function fixture(secret = 'sandbox-secret') {
    const tracking = { parseWebhookEvent: jest.fn().mockReturnValue(null) };
    const prisma = { order: { findFirst: jest.fn() } };
    const controller = new TrackingWebhookController(tracking as never, prisma as never, {} as never, { get: () => secret } as never);
    return { controller, tracking, prisma };
  }
  const rawBody = Buffer.from('{"type":"tracker.updated"}');
  const signature = createHmac('sha256', 'sandbox-secret').update(rawBody).digest('hex');
  it.each([
    { secret: '', rawBody, signature },
    { secret: 'sandbox-secret', rawBody: undefined, signature },
    { secret: 'sandbox-secret', rawBody, signature: undefined },
    { secret: 'sandbox-secret', rawBody, signature: 'bad' },
    { secret: 'sandbox-secret', rawBody, signature: '0'.repeat(64) },
  ])('rejects unverifiable event before any lookup: %j', async (input) => {
    const { controller, tracking, prisma } = fixture(input.secret);
    await expect(controller.handleWebhook({ body: {}, rawBody: input.rawBody, headers: { 'x-hmac-signature': input.signature } } as never)).rejects.toThrow();
    expect(tracking.parseWebhookEvent).not.toHaveBeenCalled();
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });
  it('accepts existing HMAC protocol only over exact raw bytes', async () => {
    const { controller, tracking } = fixture();
    await expect(controller.handleWebhook({ body: {}, rawBody, headers: { 'x-hmac-signature': signature } } as never)).resolves.toEqual({ received: true });
    expect(tracking.parseWebhookEvent).toHaveBeenCalledTimes(1);
    await expect(controller.handleWebhook({ body: {}, rawBody: Buffer.from('different'), headers: { 'x-hmac-signature': signature } } as never)).rejects.toThrow();
  });
  it('accepts the documented EasyPost algorithm-prefixed signature', async () => {
    const { controller } = fixture();
    await expect(controller.handleWebhook({ body: {}, rawBody, headers: { 'x-hmac-signature': `hmac-sha256-hex=${signature}` } } as never)).resolves.toEqual({ received: true });
  });
});

describe('Tracking delivery state and durable replay boundary', () => {
  function fixture() {
    const parent = { id: 'order', status: OrderStatus.SHIPPED as OrderStatus, adminArchivedAt: null as Date | null,
      deliveredAt: null as Date | null, trackingNumber: 'TRACK', guestEmail: 'buyer@example.test', orderNumber: 'TEST-1', user: null, items: [] };
    const shops = [{ id: 'shop', storeId: 'store', status: OrderStatus.SHIPPED as OrderStatus, trackingNumber: 'TRACK' }];
    const receipts = new Set<string>();
    const tx = {
      $queryRaw: jest.fn(),
      economicOrderContext: { findUnique: jest.fn().mockResolvedValue(null) },
      trackingDeliveryReceipt: { createMany: jest.fn(async ({ data }) => {
        if (receipts.has(data[0].eventHash)) return { count: 0 };
        receipts.add(data[0].eventHash); return { count: 1 };
      }) },
      order: {
        findUnique: jest.fn(async () => ({ ...parent })),
        updateMany: jest.fn(async ({ where, data }) => {
          if (parent.status !== where.status || parent.adminArchivedAt || ('deliveredAt' in where && parent.deliveredAt !== null)) return { count: 0 };
          Object.assign(parent, data); return { count: 1 };
        }),
      },
      storeOrder: { findMany: jest.fn(async () => shops.map(row => ({ ...row }))),
        updateMany: jest.fn(async ({ where, data }) => {
          const rows = shops.filter(row => where.id.in.includes(row.id) && row.status === where.status);
          rows.forEach(row => Object.assign(row, data)); return { count: rows.length };
        }) },
      orderStatusHistory: { create: jest.fn() },
    };
    jest.mocked(syncOrderStatusFromShops).mockImplementation(async () => {
      if (shops.every(row => ([OrderStatus.DELIVERED, OrderStatus.CANCELLED] as OrderStatus[]).includes(row.status))) parent.status = OrderStatus.DELIVERED;
    });
    const prisma = { order: { findMany: jest.fn(async () => [{ ...parent }]) }, $transaction: jest.fn(async work => work(tx)) };
    const notifications = { sendOrderDelivered: jest.fn() };
    const tracking = new TrackingService({ get: () => '' } as never);
    const controller = new TrackingWebhookController(tracking, prisma as never, notifications as never, { get: () => 'sandbox-secret' } as never);
    function request(code: string | null = 'TRACK', id = 'evt_1') {
      const rawBody = Buffer.from(JSON.stringify({ id, description: 'tracker.updated', result: { id: 'trk_1', status: 'delivered', tracking_code: code } }));
      return { body: { untrusted: true }, rawBody, headers: { 'x-hmac-signature': createHmac('sha256', 'sandbox-secret').update(rawBody).digest('hex') } } as never;
    }
    return { parent, shops, tx, prisma, notifications, controller, request };
  }
  beforeEach(() => jest.clearAllMocks());
  it.each([OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.REFUND_REQUESTED, OrderStatus.DISPUTED,
    OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.PENDING_PAYMENT])('does not reopen %s', async status => {
    const h = fixture(); h.parent.status = status;
    await h.controller.handleWebhook(h.request());
    expect(h.prisma.$transaction).not.toHaveBeenCalled(); expect(h.notifications.sendOrderDelivered).not.toHaveBeenCalled();
  });
  it('rechecks cancellation inside the transaction before any write', async () => {
    const h = fixture(); h.tx.order.findUnique.mockResolvedValueOnce({ ...h.parent, status: OrderStatus.CANCELLED });
    await h.controller.handleWebhook(h.request());
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled(); expect(h.tx.trackingDeliveryReceipt.createMany).not.toHaveBeenCalled();
  });
  it('ignores archived orders', async () => {
    const h = fixture(); h.parent.adminArchivedAt = new Date(); await h.controller.handleWebhook(h.request());
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.COMPLETED, OrderStatus.DELIVERED])('does not alter terminal shop %s or fall back to legacy delivery', async status => {
    const h = fixture(); h.shops[0].status = status; await h.controller.handleWebhook(h.request());
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled(); expect(h.tx.order.updateMany).not.toHaveBeenCalled();
  });
  it('does not fall back to unrelated shipped shops when tracking does not match', async () => {
    const h = fixture(); await h.controller.handleWebhook(h.request('OTHER'));
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled(); expect(ensureFixedOrderProgressSteps).not.toHaveBeenCalled();
  });
  it('requires a unique order lookup', async () => {
    const h = fixture(); h.prisma.order.findMany.mockResolvedValueOnce([{ ...h.parent }, { ...h.parent, id: 'other' }]);
    await h.controller.handleWebhook(h.request()); expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('claims delivery once, and an old event cannot reapply after a manual reopen', async () => {
    const h = fixture(); await h.controller.handleWebhook(h.request());
    h.parent.status = OrderStatus.SHIPPED; h.parent.deliveredAt = null; h.shops[0].status = OrderStatus.SHIPPED;
    await h.controller.handleWebhook(h.request());
    expect(h.tx.storeOrder.updateMany).toHaveBeenCalledTimes(1); expect(h.notifications.sendOrderDelivered).toHaveBeenCalledTimes(1);
    expect(h.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it('concurrent replay claims one shop mutation and one notification (unit model, not native PG)', async () => {
    const h = fixture(); await Promise.all([h.controller.handleWebhook(h.request()), h.controller.handleWebhook(h.request())]);
    expect(h.tx.storeOrder.updateMany).toHaveBeenCalledTimes(1); expect(h.notifications.sendOrderDelivered).toHaveBeenCalledTimes(1);
  });
  it('does not mark every shop delivered for an ambiguous tracker-only event', async () => {
    const h = fixture(); h.shops.push({ ...h.shops[0], id: 'other', storeId: 'other-store' });
    await h.controller.handleWebhook(h.request(null)); expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });
  it('delivers only the matching shop and waits for remaining shops', async () => {
    const h = fixture(); h.shops.push({ ...h.shops[0], id: 'other', trackingNumber: 'OTHER' });
    await h.controller.handleWebhook(h.request());
    expect(h.shops[0].status).toBe(OrderStatus.DELIVERED); expect(h.shops[1].status).toBe(OrderStatus.SHIPPED);
    expect(h.notifications.sendOrderDelivered).not.toHaveBeenCalled();
  });
  it('does not bypass versioned capture/inventory proof', async () => {
    const h = fixture(); h.tx.economicOrderContext.findUnique.mockResolvedValue({ id: 'context', policyVersion: 'unsupported' } as never);
    await expect(h.controller.handleWebhook(h.request())).rejects.toThrow('verified payment');
    expect(h.tx.trackingDeliveryReceipt.createMany).not.toHaveBeenCalled(); expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });
  it('handles legacy order delivery with a conditional status update', async () => {
    const h = fixture(); h.shops.length = 0; await h.controller.handleWebhook(h.request()); await h.controller.handleWebhook(h.request());
    expect(h.tx.orderStatusHistory.create).toHaveBeenCalledTimes(1); expect(h.notifications.sendOrderDelivered).toHaveBeenCalledTimes(1);
  });
  it('rejects a stale tracking number even when the legacy tracker ID matches', async () => {
    const h = fixture(); h.shops.length = 0; await h.controller.handleWebhook(h.request('OTHER'));
    expect(h.tx.order.updateMany).not.toHaveBeenCalled(); expect(h.tx.trackingDeliveryReceipt.createMany).not.toHaveBeenCalled();
    expect(h.notifications.sendOrderDelivered).not.toHaveBeenCalled();
  });
  it.each([null, {}, { description: 1 }, { description: 'tracker.updated', result: { id: {}, status: 'delivered' } }])('ignores malformed signed events: %j', async body => {
    const tracking = new TrackingService({ get: () => '' } as never); expect(tracking.parseWebhookEvent(body)).toBeNull();
  });
});
