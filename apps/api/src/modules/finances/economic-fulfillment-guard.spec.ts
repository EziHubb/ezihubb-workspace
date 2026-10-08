import { Prisma } from '@prisma/client';
import { assertEconomicFulfillmentAllowed, assertEconomicShopFulfillmentAllowed } from './economic-fulfillment-guard';

function fixture() {
  const context = { id: 'context', policyVersion: '2026-10-03.v1', currency: 'USD', minorExponent: 2, provenance: 'TEST', quoteHash: 'frozen' };
  const order = { status: 'CONFIRMED', adminArchivedAt: null, payment: { status: 'PAID' } };
  const capture = { id: 'capture', operationId: 'operation', provenance: 'TEST', currency: 'USD', quoteHash: 'frozen' };
  const reservation = { state: 'CONSUMED', quantity: 2, reacquisition: null as null | { captureId: string; quantity: number } };
  const tx = {
    $queryRaw: jest.fn(), economicOrderContext: { findUnique: jest.fn().mockResolvedValue(context) },
    order: { findUniqueOrThrow: jest.fn().mockResolvedValue(order) },
    economicCapture: { findUnique: jest.fn().mockResolvedValue(capture) },
    economicOutbox: { findFirst: jest.fn().mockResolvedValue({ id: 'event' }) },
    economicInventoryReservation: { findMany: jest.fn().mockResolvedValue([reservation]) },
    economicOperation: { count: jest.fn().mockResolvedValue(0) },
    economicBalanceLot: { count: jest.fn().mockResolvedValue(0) },
    storeOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'shop', status: 'CONFIRMED' }]) },
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient, context, order, capture, reservation };
}
describe('shared versioned manual fulfillment gate', () => {
  it('leaves legacy behavior unchanged and locks versioned context before the parent', async () => {
    const h = fixture(); h.tx.economicOrderContext.findUnique.mockResolvedValueOnce(null);
    expect(await assertEconomicFulfillmentAllowed(h.client, 'order')).toBe(false);
    expect(h.tx.$queryRaw).not.toHaveBeenCalled();
    expect(await assertEconomicFulfillmentAllowed(h.client, 'order')).toBe(true);
    expect(h.tx.$queryRaw.mock.calls[0][0].join('')).toContain('EconomicOrderContext');
    expect(h.tx.$queryRaw.mock.calls[1][0].join('')).toContain('Order');
    expect(h.tx.economicOutbox.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      contextId: 'context', eventType: 'capture.verified.v1', payload: { path: ['operationId'], equals: 'operation' },
      receipts: { some: { consumer: 'lifecycle.v1' } },
    }) }));
  });
  it.each(['PENDING_PAYMENT','CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED'])('blocks unsafe parent %s before inventory/fulfillment work', async status => {
    const h = fixture(); h.order.status = status;
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('verified payment');
    expect(h.tx.economicInventoryReservation.findMany).not.toHaveBeenCalled();
  });
  it('does not treat a UI paid flag, foreign capture or lifecycle-free capture as authority', async () => {
    const h = fixture(); h.tx.economicCapture.findUnique.mockResolvedValueOnce(null);
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('verified payment');
    h.capture.provenance = 'LIVE';
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('verified payment');
    h.capture.provenance = 'TEST'; h.tx.economicOutbox.findFirst.mockResolvedValueOnce(null);
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('verified payment');
  });
  it('requires original consumed stock or exact original-capture late reacquisition, not HELD stock', async () => {
    const h = fixture(); h.reservation.state = 'HELD';
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('captured inventory');
    h.reservation.state = 'EXPIRED'; h.reservation.reacquisition = { captureId: 'foreign', quantity: 2 };
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('captured inventory');
    h.reservation.reacquisition.captureId = 'capture'; h.reservation.reacquisition.quantity = 1;
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('captured inventory');
    h.reservation.reacquisition.quantity = 2;
    expect(await assertEconomicFulfillmentAllowed(h.client, 'order')).toBe(true);
    h.tx.economicInventoryReservation.findMany.mockResolvedValueOnce([]);
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('captured inventory');
  });
  it('blocks unresolved refunds, held funds and archived/unpaid orders', async () => {
    const h = fixture(); h.tx.economicOperation.count.mockResolvedValueOnce(1);
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('reconciliation');
    h.tx.economicBalanceLot.count.mockResolvedValueOnce(1);
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('reconciliation');
    Object.assign(h.order, { adminArchivedAt: new Date() });
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('verified payment');
    Object.assign(h.order, { adminArchivedAt: null, payment: { status: 'PENDING' } });
    await expect(assertEconomicFulfillmentAllowed(h.client, 'order')).rejects.toThrow('verified payment');
  });
  it('never reopens a closed shop merely because the multi-shop parent is active', async () => {
    const h = fixture(); h.tx.storeOrder.findMany.mockResolvedValueOnce([{ id: 'shop', status: 'CANCELLED' }]);
    await expect(assertEconomicShopFulfillmentAllowed(h.client, 'order', ['shop'])).rejects.toThrow('Closed or unpaid shop');
    h.tx.storeOrder.findMany.mockResolvedValueOnce([]);
    await expect(assertEconomicShopFulfillmentAllowed(h.client, 'order', ['foreign'])).rejects.toThrow('Closed or unpaid shop');
    expect(await assertEconomicShopFulfillmentAllowed(h.client, 'order', ['shop'])).toBe(true);
  });
});
