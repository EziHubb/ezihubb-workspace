import { EconomicOutbox, PrismaClient } from '@prisma/client';
import { consumeEconomicNotifications } from './economic-notifications';

function harness(mode: 'LIVE' | 'TEST' = 'LIVE') {
  let consumed = false;
  const event = { id: 'event', contextId: 'ctx', eventType: 'capture.verified.v1', payload: { operationId: 'capture-op' },
    context: { provenance: mode, policyVersion: '2026-10-03.v1' } };
  const tx = {
    economicOutbox: { findUniqueOrThrow: jest.fn(async () => event) },
    economicConsumerReceipt: { createMany: jest.fn(async () => { if (consumed) return { count: 0 }; consumed = true; return { count: 1 }; }),
      findUnique: jest.fn(async () => ({ id: 'original-lifecycle' }) as unknown) },
    economicOrderContext: { findUniqueOrThrow: jest.fn(async () => ({ id: 'ctx', orderId: 'order', provenance: mode, currency: 'USD' })) },
    economicCapture: { findUniqueOrThrow: jest.fn(async () => ({ operationId: 'capture-op', amountMinor: 100n })) },
    economicRefundRequest: { findUniqueOrThrow: jest.fn(async () => ({ settlement: { amountMinor: 50n }, capture: { contextId: 'ctx' } })) },
    order: { findUniqueOrThrow: jest.fn(async () => ({ id: 'order', orderNumber: 'EZH-synthetic', userId: 'buyer', guestEmail: null,
      user: { email: 'buyer@example.test', pushEnabled: true } })) },
    economicNotificationReceipt: { findUnique: jest.fn(async () => null), create: jest.fn() },
    notification: { create: jest.fn(async () => ({ id: 'notification' })) }, economicExternalEffect: { createMany: jest.fn() },
  };
  const db = { $transaction: jest.fn(async work => { const old = consumed; try { return await work(tx); } catch (error) { consumed = old; throw error; } }) } as unknown as PrismaClient;
  return { event: event as unknown as EconomicOutbox, tx, db, mode };
}
describe('versioned notification consumer', () => {
  it('atomically prepares original payment notification/SMTP intent once, without external I/O', async () => {
    const h = harness(); expect(await consumeEconomicNotifications(h.db, h.event, h.mode, 'smtp')).toBe(true);
    expect(h.tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ body: expect.stringContaining('USD 1.00') }) }));
    expect(h.tx.economicNotificationReceipt.create).toHaveBeenCalledWith({ data: { eventId: 'event', recipientId: 'buyer', notificationId: 'notification' } });
    expect(h.tx.economicExternalEffect.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true,
      data: [expect.objectContaining({ kind: 'EMAIL_TRANSACTIONAL', sourceEventId: 'event', providerAccount: 'smtp' })] }));
    expect(await consumeEconomicNotifications(h.db, h.event, h.mode, 'smtp')).toBe(false);
    expect(h.tx.notification.create).toHaveBeenCalledTimes(1);
  });
  it('TEST verifies original receipt but never contacts a real buyer', async () => {
    const h = harness('TEST'); await consumeEconomicNotifications(h.db, h.event, h.mode, 'smtp');
    expect(h.tx.order.findUniqueOrThrow).not.toHaveBeenCalled(); expect(h.tx.notification.create).not.toHaveBeenCalled();
    expect(h.tx.economicExternalEffect.createMany).not.toHaveBeenCalled();
  });
  it('rolls back receipt on missing lifecycle proof so a repaired original event can recover', async () => {
    const h = harness(); h.tx.economicConsumerReceipt.findUnique.mockResolvedValueOnce(null);
    await expect(consumeEconomicNotifications(h.db, h.event, h.mode, 'smtp')).rejects.toThrow('lifecycle');
    expect(await consumeEconomicNotifications(h.db, h.event, h.mode, 'smtp')).toBe(true);
  });
  it('preserves a notification tombstone after notification deletion', async () => {
    const h = harness(); h.tx.economicNotificationReceipt.findUnique.mockResolvedValue({ id: 'receipt' } as never);
    await consumeEconomicNotifications(h.db, h.event, h.mode, 'smtp'); expect(h.tx.notification.create).not.toHaveBeenCalled();
    expect(h.tx.economicExternalEffect.createMany).toHaveBeenCalledTimes(1);
  });
  it('respects in-app preference and validates original refund evidence', async () => {
    const h = harness(); h.event.eventType = 'refund.verified.v1';
    h.tx.order.findUniqueOrThrow.mockResolvedValue({ id: 'order', orderNumber: 'EZH-synthetic', userId: 'buyer', guestEmail: null,
      user: { email: 'buyer@example.test', pushEnabled: false } });
    await consumeEconomicNotifications(h.db, h.event, h.mode, 'smtp'); expect(h.tx.notification.create).not.toHaveBeenCalled();
    expect(h.tx.economicExternalEffect.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({
      payload: expect.objectContaining({ text: expect.stringContaining('refund of USD 0.50') }) })] }));
  });
});
