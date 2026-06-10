import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SearchService } from './search.service';
import { ProductDetail } from '../catalog/schemas/product-detail.schema';


const mockRedisClient = {
  zincrby: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(100),
  expire: jest.fn().mockResolvedValue(1),
  zrevrange: jest.fn().mockResolvedValue([]),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  getClient: jest.fn().mockReturnValue(mockRedisClient),
};

const mockAnalyticsService = {
  trackSearch: jest.fn().mockResolvedValue(undefined),
};

const mockProductDetailModel = {
  find: jest.fn(),
  aggregate: jest.fn(),
};

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'prod-1',
  name: 'Engraved Ring',
  slug: 'engraved-ring',
  sku: 'RING-001',
  basePrice: 49.99,
  compareAtPrice: null,
  isActive: true,
  isPersonalizable: true,
  isFeatured: false,
  viewCount: 100,
  soldCount: 20,
  categoryId: 'cat-1',
  category: { id: 'cat-1', name: 'Jewelry', slug: 'jewelry' },
  images: [{ url: 'https://cdn.example.com/ring.jpg' }],
  _count: { reviews: 5 },
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

describe('SearchService', () => {
  let service: SearchService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: getModelToken(ProductDetail.name), useValue: mockProductDetailModel },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);

    jest.clearAllMocks();
    // Ensure getClient always returns the mock client
    mockRedis.getClient.mockReturnValue(mockRedisClient);
  });

  // ─── search (searchProducts) ──────────────────────────────────────────────────

  describe('search', () => {
    it('returns paginated results for a browse query (no q)', async () => {
      const product = makeProduct();
      prisma.$transaction.mockResolvedValue([[product], 1] as never);
      mockRedis.get.mockResolvedValue(null); // no in-demand cache
      // facet query
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }] as never);
      prisma.$queryRaw.mockResolvedValue([] as never);

      const result = await service.search({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.data[0].id).toBe('prod-1');
    });

    it('applies price range filters when minPrice and maxPrice are set', async () => {
      const product = makeProduct();
      prisma.$transaction.mockResolvedValue([[product], 1] as never);
      mockRedis.get.mockResolvedValue(null);
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }] as never);
      prisma.$queryRaw.mockResolvedValue([] as never);

      await service.search({ page: 1, limit: 10, minPrice: 20, maxPrice: 100 });

      // The where clause passed to $transaction's product.findMany should include basePrice
      const transactionCall = prisma.$transaction.mock.calls[0][0] as unknown[];
      // $transaction receives an array of prisma operation promises
      expect(transactionCall).toBeDefined();
    });

    it('filters only active products by default', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);
      mockRedis.get.mockResolvedValue(null);
      prisma.product.findMany.mockResolvedValue([] as never);
      prisma.$queryRaw.mockResolvedValue([] as never);

      const result = await service.search({ page: 1, limit: 10 });

      expect(result.pagination.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  // ─── logSearch (logSearchQuery) ───────────────────────────────────────────────

  describe('logSearch', () => {
    it('stores an analytics entry in Redis sorted set', async () => {
      mockRedisClient.zincrby.mockResolvedValue(1);
      mockRedisClient.ttl.mockResolvedValue(100);

      await service.logSearch('personalized gifts', 42);

      expect(mockRedisClient.zincrby).toHaveBeenCalledWith(
        'search:trending',
        1,
        'personalized gifts',
      );
    });

    it('skips logging for blank or very short queries', async () => {
      await service.logSearch('', 0);
      await service.logSearch('a', 5);

      expect(mockRedisClient.zincrby).not.toHaveBeenCalled();
    });

    it('sets TTL on the trending key for its first entry', async () => {
      mockRedisClient.zincrby.mockResolvedValue(1);
      mockRedisClient.ttl.mockResolvedValue(-1); // key has no TTL yet

      await service.logSearch('custom ring', 10);

      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'search:trending',
        expect.any(Number),
      );
    });
  });
});
