import { OrderProgressStepKind, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreOrdersService } from '../stores/store-orders.service';
import { OrderProgressService } from '../orders/order-progress.service';
import { OrdersService } from '../orders/orders.service';

function fixture() {
  const order = { id: 'order', status: 'CONFIRMED', adminArchivedAt: null, payment: { status: 'PAID' } };
  const shop = { id: 'shop', storeId: 'store', orderId: 'order', status: 'CONFIRMED', order: {} };
  const step = { id: 'target', storeId: 'store', name: 'In production', kind: OrderProgressStepKind.IN_PRODUCTION };
  const tx = {
    $queryRaw: jest.fn(),
    economicOrderContext: { findUnique: jest.fn().mockResolvedValue({ id: 'context', policyVersion: '2026-10-03.v1', currency: 'USD', minorExponent: 2, provenance: 'TEST' }) },
    economicCapture: { findUnique: jest.fn().mockResolvedValue(null) },
    order: { findUniqueOrThrow: jest.fn().mockResolvedValue(order), update: jest.fn() },
    storeOrder: { findMany: jest.fn().mockResolvedValue([shop]), update: jest.fn(), updateMany: jest.fn() },
    orderProgressStep: { update: jest.fn(), deleteMany: jest.fn() },
  };
  const db = {
    $transaction: jest.fn(async work => work(tx)),
    order: { findUnique: jest.fn().mockResolvedValue(order) },
    storeOrder: { findUnique: jest.fn().mockResolvedValue(shop), findMany: jest.fn().mockResolvedValue([shop]) },
    orderProgressStep: { findFirst: jest.fn().mockResolvedValue(step) },
  };
  const prisma = db as unknown as PrismaService;
  const email = { add: jest.fn() }, offers = { fireOffer: jest.fn() };
  const seller = new StoreOrdersService(prisma, email as never, offers as never);
  const progress = new OrderProgressService(prisma);
  const tracker = { registerTracker: jest.fn() };
  const admin = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(admin, { prisma, trackingService: tracker });
  return { db, tx, seller, progress, admin, tracker, email, offers, step };
}

describe('all manual fulfillment entry points require original versioned proof', () => {
  const noWrite = (h: ReturnType<typeof fixture>) => {
    expect(h.tx.order.update).not.toHaveBeenCalled();
    expect(h.tx.storeOrder.update).not.toHaveBeenCalled();
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(h.email.add).not.toHaveBeenCalled();
    expect(h.offers.fireOffer).not.toHaveBeenCalled();
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  };
  it('blocks seller status changes before updating the shop row', async () => {
    const h = fixture();
    await expect(h.seller.updateStoreOrder('store', 'shop', { status: 'IN_PRODUCTION' })).rejects.toThrow('verified payment');
    noWrite(h);
  });
  it('blocks seller dispatch before updating tracking or sending legacy notifications', async () => {
    const h = fixture();
    await expect(h.seller.markStoreOrderShipped('store', 'shop', { trackingNumber: 'tracking' })).rejects.toThrow('verified payment');
    noWrite(h);
  });
  it('blocks bulk progress moves before writing any selected order', async () => {
    const h = fixture();
    await expect(h.progress.moveOrders('store', ['shop'], 'target')).rejects.toThrow('verified payment');
    noWrite(h);
  });
  it('blocks custom-step deletion when rehoming would reopen an unverified versioned order', async () => {
    const h = fixture();
    jest.spyOn(h.progress, 'listSteps').mockResolvedValue([h.step, { ...h.step, id: 'custom', name: 'Packing', kind: OrderProgressStepKind.CUSTOM }] as never);
    await expect(h.progress.saveSteps('store', [])).rejects.toThrow('verified payment');
    expect(h.tx.orderProgressStep.deleteMany).not.toHaveBeenCalled();
    noWrite(h);
  });
  it('blocks platform direct status changes instead of trusting the legacy paid flag', async () => {
    const h = fixture();
    await expect(h.admin.updateStatus('order', { status: OrderStatus.IN_PRODUCTION }, 'operator')).rejects.toThrow('verified payment');
    noWrite(h);
  });
  it('blocks platform dispatch before creating an external tracker', async () => {
    const h = fixture();
    await expect(h.admin.markShipped('order', { trackingNumber: 'tracking', carrier: 'carrier', trackingUrl: 'https://carrier.test/track' }, 'operator', null)).rejects.toThrow('verified payment');
    expect(h.tracker.registerTracker).not.toHaveBeenCalled();
    noWrite(h);
  });
});
