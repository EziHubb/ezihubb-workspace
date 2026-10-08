import { FinancesService } from './finances.service';
import { legacyLedgerWhere } from './finance-reporting-scope';

describe('finance cancellation reporting', () => {
  it('leaves a previous month intact and books reversals in the cancellation month', async () => {
    const entries = [
      { type: 'SALE', amount: 50, reversalOfId: null, createdAt: new Date(2026, 7, 10) },
      { type: 'TRANSACTION_FEE', amount: -5, reversalOfId: null, createdAt: new Date(2026, 7, 10) },
      { type: 'SALE', amount: -50, reversalOfId: 'sale', createdAt: new Date(2026, 8, 8) },
      { type: 'TRANSACTION_FEE', amount: 5, reversalOfId: 'fee', createdAt: new Date(2026, 8, 8) },
    ];
    const service = Object.create(FinancesService.prototype) as FinancesService;
    const findMany = jest.fn(({ where }) => {
      const scoped = where.AND[0];
      expect(where).toEqual(legacyLedgerWhere(scoped));
      return entries.filter(entry => entry.createdAt >= scoped.createdAt.gte && entry.createdAt < scoped.createdAt.lt);
    });
    Object.assign(service, { prisma: { sellerLedgerEntry: { findMany } } });
    const august = await service.getActivitySummary('store', 8, 2026);
    const september = await service.getActivitySummary('store', 9, 2026);
    expect(august).toMatchObject({ netProfit: 45, sales: { total: 50, totalSalesCount: 1, cancellations: 0 } });
    expect(september).toMatchObject({ netProfit: -45, sales: { total: -50, totalSalesCount: 0, cancellations: -50 }, fees: { total: 5 } });
    expect(august.netProfit + september.netProfit).toBe(0);
  });
});
