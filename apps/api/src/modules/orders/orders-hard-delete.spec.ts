import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

function setup(orderOverrides: Record<string, unknown> = {}) {
  const order = {
    id:          'order-1',
    orderNumber: 'EZH-123456',
    status:      'CANCELLED',
    payment:     null,
    commission:  null,
    adminArchivedAt: null,
    shippingSubsidy: 0,
    _count: { giftCardUsages: 0 },
    tracking:    { id: 'tracking-1' },
    storeOrders: [{ id: 'store-order-1', payoutId: null, ledgerEntries: [] }],
    ...orderOverrides,
  };

  const tx = {
    order:                 { findUnique: jest.fn().mockResolvedValue(order), delete: jest.fn().mockResolvedValue(order), update: jest.fn().mockResolvedValue(order) },
    giftCardUsage:         { findMany: jest.fn().mockResolvedValue([{ giftCardId: 'gift-1', amount: 10 }]), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    promotionUsage:        { findMany: jest.fn().mockResolvedValue([{ promotionId: 'promo-1' }, { promotionId: 'promo-1' }]), deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    giftCard:              { update: jest.fn().mockResolvedValue({}) },
    promotion:             { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    storeLinkClick:        { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    affiliateClick:        { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    review:                { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    conversation:          { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    trackingEvent:         { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderTracking:         { delete: jest.fn().mockResolvedValue({}) },
    affiliateCommission:   { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    payment:               { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    orderItem:             { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    storeOrderFulfillment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    sellerLedgerEntry:     { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    storeOrder:            { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderStatusHistory:    { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, { prisma });
  return { service, tx };
}

describe('OrdersService permanentlyDeleteCancelledOrder', () => {
  it('physically removes only an order with no financial history', async () => {
    const { service, tx } = setup();

    await expect(service.permanentlyDeleteCancelledOrder('order-1', 'admin')).resolves.toEqual({
      deleted: true,
      archived: false,
      orderId: 'order-1',
      orderNumber: 'EZH-123456',
    });

    expect(tx.giftCard.update).not.toHaveBeenCalled();
    expect(tx.promotion.updateMany).toHaveBeenCalledWith({
      where: { id: 'promo-1', currentUses: { gte: 2 } },
      data:  { currentUses: { decrement: 2 } },
    });
    expect(tx.conversation.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      data:  { orderId: null },
    });
    expect(tx.orderItem.deleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(tx.storeOrder.deleteMany.mock.invocationCallOrder[0]);
    expect(tx.order.delete).toHaveBeenCalledWith({ where: { id: 'order-1' } });
  });

  it('refuses to permanently delete an active order', async () => {
    const { service, tx } = setup({ status: 'CONFIRMED' });
    await expect(service.permanentlyDeleteCancelledOrder('order-1', 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.delete).not.toHaveBeenCalled();
  });

  it.each(['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'PENDING', 'FAILED'])('retains %s payment history instead of changing payment statistics', async (status) => {
    const { service, tx } = setup({ payment: { status } });
    await expect(service.permanentlyDeleteCancelledOrder('order-1', 'admin', 'Cleanup')).resolves.toMatchObject({ deleted: false, archived: true });
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: { adminArchivedAt: expect.any(Date), adminArchivedBy: 'admin', adminArchiveReason: 'Cleanup' } });
    expect(tx.payment.deleteMany).not.toHaveBeenCalled();
    expect(tx.sellerLedgerEntry.deleteMany).not.toHaveBeenCalled();
    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.order.delete).not.toHaveBeenCalled();
  });

  it.each([
    { _count: { giftCardUsages: 1 } },
    { shippingSubsidy: 5 },
    { labelPurchasedAt: new Date() },
    { commission: { status: 'PAID' } },
    { storeOrders: [{ id: 'so', payoutId: 'payout', ledgerEntries: [] }] },
    { storeOrders: [{ id: 'so', payoutId: null, ledgerEntries: [{ id: 'ledger' }] }] },
  ])('retains non-payment financial records: %j', async (history) => {
    const { service, tx } = setup(history);
    await expect(service.permanentlyDeleteCancelledOrder('order-1', 'admin')).resolves.toMatchObject({ archived: true });
    expect(tx.order.delete).not.toHaveBeenCalled();
    expect(tx.storeOrder.deleteMany).not.toHaveBeenCalled();
    expect(tx.giftCard.update).not.toHaveBeenCalled();
    expect(tx.giftCardUsage.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps the original archive date when retried', async () => {
    const adminArchivedAt = new Date('2026-09-01');
    const { service, tx } = setup({ adminArchivedAt });
    await service.permanentlyDeleteCancelledOrder('order-1', 'another-admin');
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: {} });
    expect(tx.order.delete).not.toHaveBeenCalled();
  });
});
