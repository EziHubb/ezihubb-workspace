import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { ShopStatsService } from '../shop-stats/shop-stats.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { LEGACY_FINANCE_REPORT } from './finance-reporting-scope';
import { readLegacyRevenueSeries } from './legacy-revenue-series';

const start = new Date('2026-10-01T12:30:00Z');
const end = new Date('2026-10-03T11:45:00Z');

describe('historical revenue DB series boundary', () => {
  it('keeps shop scope parameterized and never aggregates the parent multi-shop total', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([{ date: '2026-10-01', orders: 2n, revenue: '30.50' }]) };
    const result = await readLegacyRevenueSeries(db, start, end, "shop' OR 1=1 --");
    expect(result).toEqual([{ date: '2026-10-01', orders: 2, revenue: 30.5 },
      { date: '2026-10-02', orders: 0, revenue: 0 }, { date: '2026-10-03', orders: 0, revenue: 0 }]);
    const query = db.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.text).not.toContain("shop' OR 1=1 --");
    expect(query.values).toEqual(["shop' OR 1=1 --", start, end]);
    expect(query.text).not.toContain('THEN o.total');
    expect(query.text).toContain('so."discountAmount"');
    expect(query.text).toContain('so."shippingSubsidy"');
    expect(query.text).toContain('so.status NOT IN');
    expect(query.text).toContain('o.status NOT IN');
    expect(query.text).toContain('p.status = \'PAID\'');
    expect(query.text).toContain('NOT EXISTS');
    expect(query.text).toContain('"EconomicOrderContext"');
    expect(query.text).not.toContain('adminArchivedAt'); // hiding must not erase money
  });
  it('uses legacy order totals once each in the platform branch, with no shop join duplication', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([]) };
    expect(await readLegacyRevenueSeries(db, start, end, null)).toHaveLength(3);
    const query = db.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.text).toContain('THEN o.total');
    expect(query.text).not.toContain('JOIN "StoreOrder"');
    expect(query.values).toEqual([start, end]);
  });
  it.each([new Date('invalid'), new Date('2026-09-30'), new Date('2027-10-03')])('rejects invalid/reversed/unbounded windows before querying: %s', async (invalidEnd) => {
    const db = { $queryRaw: jest.fn() };
    await expect(readLegacyRevenueSeries(db, start, invalidEnd)).rejects.toThrow('window');
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('does not treat an empty shop scope as platform authorization', async () => {
    const db = { $queryRaw: jest.fn() };
    await expect(readLegacyRevenueSeries(db, start, end, ' ')).rejects.toThrow('shop scope');
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it.each([
    { date: '2026-09-30', orders: 1n, revenue: '1.00' },
    { date: '2026-10-02', orders: 9007199254740993n, revenue: '1.00' },
    { date: '2026-10-02', orders: -1n, revenue: '1.00' },
    { date: '2026-10-02', orders: 1n, revenue: 'NaN' },
  ])('fails closed for invalid aggregate evidence: %s', async (row) => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([row]) };
    await expect(readLegacyRevenueSeries(db, start, end)).rejects.toThrow('aggregate');
  });
});

describe('historical overview and analytics use the same authority', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-08T12:30:00Z')); });
  afterEach(() => jest.useRealTimers());
  const rows = [{ date: '2026-10-01', orders: 2n, revenue: '30.50' }, { date: '2026-10-08', orders: 1n, revenue: '12.25' }];
  function fixtures(available = true) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows), order: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn() } };
    const client = { mget: jest.fn(async (...keys: string[]) => keys.map(() => '3')), get: jest.fn().mockResolvedValue('999999') };
    const redis = { isAvailable: jest.fn(() => available), getClient: jest.fn(() => client) };
    return { prisma, client, redis, service: new ShopStatsService(prisma as unknown as PrismaService, redis as unknown as RedisService) };
  }
  it.each(['shop', null])('overview totals equal the complete series, Redis is traffic only: %s', async (shop) => {
    const { service, prisma, client } = fixtures();
    const result = await service.getOverview('7d', shop);
    expect(result).toMatchObject({ financeReporting: LEGACY_FINANCE_REPORT, orders: 3, revenue: 42.75, visits: 24 });
    expect(result.series).toHaveLength(8); // both partial boundary dates are retained
    expect(result.series.reduce((sum, row) => sum + row.revenue, 0)).toBe(result.revenue);
    expect(result.series.reduce((sum, row) => sum + row.orders, 0)).toBe(result.orders);
    expect(client.get).not.toHaveBeenCalled();
    expect(client.mget.mock.calls[0]).toEqual(result.series.map(({ date }) => shop
      ? `analytics:store:${shop}:${date}:visits` : `analytics:visits:${date}`));
    expect(prisma.order.aggregate).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
  it('DB money remains available when Redis is unavailable', async () => {
    const { service, client } = fixtures(false);
    expect(await service.getOverview('7d', 'shop')).toMatchObject({ orders: 3, revenue: 42.75, visits: 0 });
    expect(client.mget).not.toHaveBeenCalled();
  });
  it('Redis failure or corrupt traffic cannot replace revenue or produce NaN', async () => {
    const { service, client } = fixtures();
    client.mget.mockResolvedValueOnce(['NaN', '-5', 'Infinity', '2.5']);
    expect(await service.getOverview('7d')).toMatchObject({ revenue: 42.75, visits: 0 });
    client.mget.mockRejectedValueOnce(new Error('offline'));
    expect(await service.getOverview('7d')).toMatchObject({ revenue: 42.75, visits: 0 });
  });
  it('DB failures propagate, never falling back to apparently successful Redis money', async () => {
    const { service, prisma, client } = fixtures();
    prisma.$queryRaw.mockRejectedValue(new Error('DB unavailable'));
    await expect(service.getOverview('7d')).rejects.toThrow('DB unavailable');
    expect(client.get).not.toHaveBeenCalled();
  });
  it('analytics revenue uses bounded UTC days and labels each row LEGACY_UNKNOWN', async () => {
    const { prisma, redis, client } = fixtures();
    prisma.$queryRaw.mockResolvedValue([{ date: '2026-10-08', orders: 1n, revenue: '12.25' }]);
    const analytics = new AnalyticsService(prisma as unknown as PrismaService, redis as unknown as RedisService);
    expect(await analytics.getDailyRevenue(1)).toEqual([{ date: '2026-10-08', orders: 1, revenue: 12.25, financeReporting: LEGACY_FINANCE_REPORT }]);
    const query = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual([new Date('2026-10-08T00:00:00Z'), new Date('2026-10-08T12:30:00Z')]);
    expect(client.get).not.toHaveBeenCalled();
    await expect(analytics.getDailyRevenue(91)).rejects.toThrow('days');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
