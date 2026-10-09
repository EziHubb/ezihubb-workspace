import { ProductsService } from './products.service';

describe('Product performance reports observed data, not generated traffic', () => {
  function fixture() {
    const service = Object.create(ProductsService.prototype) as ProductsService;
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ viewCount: 1000, soldCount: 8, createdAt: new Date('2026-01-01') }) },
      orderItem: { aggregate: jest.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { unitPrice: 1 } }) },
      $queryRaw: jest.fn().mockResolvedValue([{ day: '2026-10-09', orders: 2n, revenue: 40 }]),
      review: { aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { _all: 2 } }) },
      wishlistItem: { count: jest.fn().mockResolvedValue(3) },
    };
    Object.assign(service, { prisma, requireProduct: jest.fn().mockResolvedValue({ id: 'product' }) });
    return { service, prisma };
  }
  beforeEach(() => { jest.useFakeTimers().setSystemTime(new Date('2026-10-09T13:00:00Z')); });
  afterEach(() => jest.useRealTimers());
  it.each(['7d', '30d', '90d', '1y'])('returns unavailable period traffic for %s, preserving observed order/revenue data', async range => {
    const h = fixture(); const result = await h.service.getPerformanceStats('product', range);
    expect(result.views).toBeNull(); expect(result.viewsTrend).toBeNull(); expect(result.conversionRate).toBeNull();
    expect(result.viewsTotal).toBe(1000); expect(result.trafficSources).toEqual([]);
    expect(result.chartData.every(row => row.views === null)).toBe(true);
    expect(result.orders).toBe(2); expect(result.revenue).toBe(40);
    expect(result.chartData.at(-1)).toEqual({ date: '2026-10-09', views: null, orders: 2, revenue: 40 });
    expect(result.analyticsReporting.chartTimezone).toBe('UTC');
  });
  it('all-time uses the real lifetime counter and shows the most recent 365 chart days', async () => {
    const h = fixture(); const result = await h.service.getPerformanceStats('product', 'all');
    expect(result.views).toBe(1000); expect(result.viewsTrend).toBeNull(); expect(result.ordersTrend).toBeNull();
    expect(result.chartData).toHaveLength(365); expect(result.chartData.at(-1)?.date).toBe('2026-10-09');
    expect(h.prisma.orderItem.aggregate.mock.calls[0][0].where.order.AND[0].createdAt.gte).toEqual(new Date(0));
  });
  it('reloads return identical data without any random generation', async () => {
    const h = fixture(); expect(await h.service.getPerformanceStats('product', '30d')).toEqual(await h.service.getPerformanceStats('product', '30d'));
  });
});
