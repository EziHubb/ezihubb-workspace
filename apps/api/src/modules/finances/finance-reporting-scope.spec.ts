import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import { OffsiteAdsService } from '../marketing/offsite-ads.service';
import { ShareSaveService } from '../marketing/share-save.service';
import { LEGACY_FINANCE_REPORT, LEGACY_LEDGER_SQL, legacyLedgerWhere, legacyStoreOrderWhere } from './finance-reporting-scope';

describe('historical monetary readers cannot inherit versioned funds', () => {
  it('retains store/date/status predicates and unlinked listing fees, excluding versioned shop ledger rows', () => {
    const where = { storeId: 'own-store', payoutId: null, createdAt: { gte: new Date(0) } };
    expect(legacyLedgerWhere(where)).toEqual({ AND: [where, { OR: [{ storeOrderId: null }, { storeOrder: legacyStoreOrderWhere() }] }] });
    expect(LEGACY_LEDGER_SQL.text).toContain('"storeOrderId" IS NULL'); expect(LEGACY_LEDGER_SQL.text).toContain('NOT EXISTS');
    expect(LEGACY_LEDGER_SQL.values).toEqual([]);
  });
  it('store dashboard derives historical revenue from scoped rows, never cached lifetime revenue', async () => {
    const prisma = {
      storeOrder: { aggregate: jest.fn(async (_query: { where: { AND: Array<Record<string, unknown>> } }) => ({ _sum: { sellerEarnings: new Prisma.Decimal('12.34') } })),
        count: jest.fn(async ({ where }) => where.AND ? 2 : 7), findMany: jest.fn(async () => []) },
      review: { count: jest.fn(async () => 0) },
      store: { findUniqueOrThrow: jest.fn(async () => ({ totalRevenue: '9999999', totalOrders: 123456 })) },
    };
    const result = await new AdminService(prisma as unknown as PrismaService).getDashboardKPIs('own-store');
    expect(result).toMatchObject({ totalRevenue: 12.34, totalOrders: 7, averageOrderValue: 6.17, financeReporting: LEGACY_FINANCE_REPORT });
    expect(prisma.store.findUniqueOrThrow).not.toHaveBeenCalled();
    for (const [call] of prisma.storeOrder.aggregate.mock.calls) expect(call.where).toMatchObject({ AND: [expect.objectContaining({ storeId: 'own-store' }),
      { order: { AND: [{}, { economicContext: { is: null } }] } }] });
  });
  it('marketing monetary aggregates are historical while click counts remain operational', async () => {
    const prisma = { store: { findUnique: jest.fn(async () => ({ offsiteAdsOptedOut: false, slug: 'shop', shareSaveEnabled: true })) },
      sellerLedgerEntry: { aggregate: jest.fn(async (_query: { where: { AND: Array<Record<string, unknown>> } }) => ({ _sum: { amount: new Prisma.Decimal('-1.23') } })) },
      storeOrder: { findMany: jest.fn(async () => []) }, storeLinkClick: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []), count: jest.fn(async () => 4) } };
    expect(await new OffsiteAdsService(prisma as unknown as PrismaService).getStats('own-store')).toMatchObject({ financeReporting: LEGACY_FINANCE_REPORT });
    expect(await new ShareSaveService(prisma as unknown as PrismaService).getStatus('own-store')).toMatchObject({ financeReporting: LEGACY_FINANCE_REPORT,
      stats: { clicks30d: 4, conversions30d: 4, refunded30d: 1.23 } });
    for (const [call] of prisma.sellerLedgerEntry.aggregate.mock.calls) expect(call.where.AND[0].storeId).toBe('own-store');
    expect(prisma.storeOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: expect.any(Array) }) }));
  });
});
