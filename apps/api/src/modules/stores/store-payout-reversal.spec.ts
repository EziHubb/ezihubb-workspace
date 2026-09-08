import { StoreOrdersService } from './store-orders.service';

describe('payout with cancellation reversals', () => {
  it('deducts a previously settled sale without treating it as a fee or replacing the old payout link', async () => {
    const entries = [
      { id: 'sale', type: 'SALE', amount: 100, storeOrderId: 'new' },
      { id: 'fee', type: 'TRANSACTION_FEE', amount: -10, storeOrderId: 'new' },
      { id: 'old-sale-reversal', type: 'SALE', amount: -50, storeOrderId: 'old-paid' },
      { id: 'old-fee-reversal', type: 'TRANSACTION_FEE', amount: 5, storeOrderId: 'old-paid' },
    ];
    const tx = {
      sellerLedgerEntry: { findMany: jest.fn().mockResolvedValue(entries), updateMany: jest.fn() },
      storeOrder: { count: jest.fn().mockResolvedValue(1), updateMany: jest.fn() },
      sellerPayout: { create: jest.fn().mockResolvedValue({ id: 'new-payout' }) },
    };
    const service = Object.create(StoreOrdersService.prototype) as StoreOrdersService;
    Object.assign(service, { prisma: { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) } });
    await service.requestPayout('store', {});
    expect(tx.sellerPayout.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 45, platformFee: 5, orderCount: 1 }) });
    expect(tx.storeOrder.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['new', 'old-paid'] }, payoutId: null },
      data: { payoutId: 'new-payout' },
    });
  });
});
