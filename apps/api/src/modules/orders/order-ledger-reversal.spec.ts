import { Prisma, SellerLedgerEntryType } from '@prisma/client';
import { reverseCancelledOrderLedger } from './order-ledger-reversal';

describe('cancellation ledger', () => {
  it('preserves original entries and reverses sale, fees and credits exactly once across retries', async () => {
    const original = [
      { id: 'sale', type: 'SALE', amount: new Prisma.Decimal('50') },
      { id: 'fee', type: 'TRANSACTION_FEE', amount: new Prisma.Decimal('-3.25') },
      { id: 'credit', type: 'SHARE_SAVE_REFUND', amount: new Prisma.Decimal('2') },
    ].map((row) => ({ ...row, type: row.type as SellerLedgerEntryType, storeId: 'store', storeOrderId: 'so', description: row.id }));
    const inserted = new Map<string, { amount: Prisma.Decimal }>();
    const createMany = jest.fn(async ({ data, skipDuplicates }) => {
      for (const row of data) {
        if (inserted.has(row.reversalOfId) && !skipDuplicates) throw new Error('duplicate reversal');
        inserted.set(row.reversalOfId, row);
      }
    });
    const tx = { sellerLedgerEntry: { findMany: jest.fn().mockResolvedValue(original), createMany } };
    await reverseCancelledOrderLedger(tx as unknown as Prisma.TransactionClient, 'order');
    await reverseCancelledOrderLedger(tx as unknown as Prisma.TransactionClient, 'order');
    expect(inserted.size).toBe(3);
    expect([...inserted.values()].map((entry) => entry.amount.toString())).toEqual(['-50', '3.25', '-2']);
    expect(original.map((entry) => entry.amount.toString())).toEqual(['50', '-3.25', '2']);
    expect(createMany.mock.calls[0][0].data.every((entry: { payoutId?: string }) => !entry.payoutId)).toBe(true);
  });
});
