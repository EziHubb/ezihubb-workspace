import { EconomicOutbox } from '@prisma/client';
import { consumeVerifiedEconomics } from './economic-consumers';
import { consumeCapturedInventory } from '../products/inventory-reservation';

jest.mock('../products/inventory-reservation', () => ({ consumeCapturedInventory: jest.fn() }));
function fixture(type = 'capture.verified.v1') {
  const context = { id: 'context', orderId: 'order', provenance: 'TEST', policyVersion: '2026-10-03.v1' };
  const event = { id: 'event', contextId: context.id, eventType: type, payload: { operationId: 'operation' }, context };
  const order = { id: 'order', status: 'PENDING_PAYMENT', payment: { status: 'PAID' }, storeOrders: [] };
  const capture = { id: 'capture', contextId: 'context', operationId: 'operation', provenance: 'TEST', amountMinor: 200n };
  const receipt = { count: 1 };
  const tx = {
    $queryRaw: jest.fn(), economicOutbox: { findUniqueOrThrow: jest.fn().mockResolvedValue(event) },
    economicConsumerReceipt: { createMany: jest.fn().mockResolvedValue(receipt) },
    economicOrderContext: { findUniqueOrThrow: jest.fn().mockResolvedValue(context) },
    order: { findUniqueOrThrow: jest.fn().mockResolvedValue(order), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    economicCapture: { findUniqueOrThrow: jest.fn().mockResolvedValue(capture) },
    storeOrder: { updateMany: jest.fn() }, payment: { updateMany: jest.fn() }, orderStatusHistory: { create: jest.fn() },
    economicRefundRequest: { findUniqueOrThrow: jest.fn().mockResolvedValue({ captureId: 'capture', capture, settlement: { id: 'refund' } }) },
    economicRefund: { findMany: jest.fn().mockResolvedValue([{ amountMinor: 200n }]) },
  };
  const db = { $transaction: jest.fn(async work => work(tx)) } as unknown as Parameters<typeof consumeVerifiedEconomics>[0];
  return { db, tx, event: event as unknown as EconomicOutbox, order, capture, receipt, context };
}
describe('versioned durable lifecycle consumers', () => {
  beforeEach(() => jest.clearAllMocks());
  it('consumes captured stock and confirms the seller work queue exactly once', async () => {
    const h = fixture();
    expect(await consumeVerifiedEconomics(h.db, h.event, 'TEST')).toBe(true);
    expect(consumeCapturedInventory).toHaveBeenCalledWith(h.tx, 'capture');
    expect(h.tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }));
    expect(h.tx.storeOrder.updateMany).toHaveBeenCalledWith({ where: { orderId: 'order', status: 'PENDING_PAYMENT' }, data: { status: 'CONFIRMED' } });
    h.receipt.count = 0;
    expect(await consumeVerifiedEconomics(h.db, h.event, 'TEST')).toBe(false);
    expect(consumeCapturedInventory).toHaveBeenCalledTimes(1);
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it('failed stock reacquisition propagates so receipt and lifecycle effects roll back', async () => {
    const h = fixture();
    jest.mocked(consumeCapturedInventory).mockRejectedValueOnce(new Error('Insufficient original pool'));
    await expect(consumeVerifiedEconomics(h.db, h.event, 'TEST')).rejects.toThrow('original pool');
    expect(h.tx.order.updateMany).not.toHaveBeenCalled();
  });
  it.each(['CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED'])('never consumes or reopens a closed captured order (%s)', async status => {
    const h = fixture(); h.order.status = status;
    await expect(consumeVerifiedEconomics(h.db, h.event, 'TEST')).rejects.toThrow('Closed order');
    expect(consumeCapturedInventory).not.toHaveBeenCalled();
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });
  it('does not consume an archived parent or a closed shop in a multi-shop order', async () => {
    const h = fixture(); Object.assign(h.order, { adminArchivedAt: new Date() });
    await expect(consumeVerifiedEconomics(h.db, h.event, 'TEST')).rejects.toThrow('Closed order');
    Object.assign(h.order, { adminArchivedAt: null, storeOrders: [{ status: 'CANCELLED' }] });
    await expect(consumeVerifiedEconomics(h.db, h.event, 'TEST')).rejects.toThrow('Closed order');
    expect(consumeCapturedInventory).not.toHaveBeenCalled();
  });
  it.each(['LIVE', 'LEGACY'])('does not consume another provenance/policy (%s)', async provenance => {
    const h = fixture();
    if (provenance === 'LEGACY') h.context.policyVersion = 'legacy';
    await expect(consumeVerifiedEconomics(h.db, h.event, provenance === 'LIVE' ? 'LIVE' : 'TEST')).rejects.toThrow('Unsupported');
    expect(consumeCapturedInventory).not.toHaveBeenCalled();
  });
  it('requires stored capture and payment evidence instead of trusting event payload', async () => {
    const h = fixture(); h.capture.operationId = 'foreign';
    await expect(consumeVerifiedEconomics(h.db, h.event, 'TEST')).rejects.toThrow('Capture proof');
    expect(consumeCapturedInventory).not.toHaveBeenCalled();
  });
  it('full refund closes the order but preserves paid timestamp and never restocks', async () => {
    const h = fixture('refund.verified.v1');
    expect(await consumeVerifiedEconomics(h.db, h.event, 'TEST')).toBe(true);
    expect(h.tx.payment.updateMany).toHaveBeenCalledWith({ where: { orderId: 'order', status: 'PAID' }, data: { status: 'REFUNDED' } });
    expect(h.tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'REFUNDED' } }));
    expect(consumeCapturedInventory).not.toHaveBeenCalled();
  });
  it('partial refund preserves order progress and requires immutable settlement', async () => {
    const h = fixture('refund.verified.v1');
    h.tx.economicRefund.findMany.mockResolvedValue([{ amountMinor: 100n }]);
    await consumeVerifiedEconomics(h.db, h.event, 'TEST');
    expect(h.tx.order.updateMany).not.toHaveBeenCalled();
    h.tx.economicRefundRequest.findUniqueOrThrow.mockResolvedValue({ captureId: 'capture', capture: h.capture, settlement: null } as never);
    await expect(consumeVerifiedEconomics(h.db, h.event, 'TEST')).rejects.toThrow('settlement proof');
  });
  it('rejects an unsupported event without beginning a transaction', async () => {
    const h = fixture('legacy.paid');
    await expect(consumeVerifiedEconomics(h.db, h.event, 'TEST')).rejects.toThrow('Unsupported');
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });
});
