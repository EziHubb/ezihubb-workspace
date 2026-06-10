import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { CatalogService } from './catalog.service';
import { CategoryMenu } from './schemas/category-menu.schema';
import { ProductDetail } from './schemas/product-detail.schema';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockCategoryMenuModel = {
  find: jest.fn(),
  deleteMany: jest.fn(),
  insertMany: jest.fn(),
};

const mockProductDetailModel = {
  aggregate: jest.fn(),
  find: jest.fn(),
};

const makeCategory = (overrides: Record<string, unknown> = {}) => ({
  id: 'cat-1',
  name: 'Jewelry',
  slug: 'jewelry',
  description: null,
  imageUrl: null,
  sortOrder: 0,
  isVisible: true,
  parentId: null,
  createdAt: new Date('2024-01-01'),
  children: [],
  _count: { products: 3 },
  ...overrides,
});

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: getModelToken(CategoryMenu.name), useValue: mockCategoryMenuModel },
        { provide: getModelToken(ProductDetail.name), useValue: mockProductDetailModel },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);

    jest.clearAllMocks();
  });

  // ─── getCategories ────────────────────────────────────────────────────────────

  describe('getCategories', () => {
    it('returns Redis-cached category tree when present', async () => {
      const cached = [{ id: 'cat-1', name: 'Jewelry', slug: 'jewelry', children: [] }];
      mockRedis.get.mockResolvedValue(cached);

      const result = await service.getCategories();

      expect(result).toEqual(cached);
      expect(prisma.category.findMany).not.toHaveBeenCalled();
    });

    it('fetches from DB, builds tree, and caches when Redis miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      const dbCategory = makeCategory();
      prisma.category.findMany.mockResolvedValue([dbCategory] as never);

      const result = await service.getCategories();

      expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-1');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('filters out non-root categories (parentId !== null) from the tree root', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      const root = makeCategory({ parentId: null });
      const child = makeCategory({ id: 'cat-2', slug: 'rings', parentId: 'cat-1' });
      prisma.category.findMany.mockResolvedValue([root, child] as never);

      const result = await service.getCategories();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-1');
    });
  });

  // ─── getCategoryBySlug ────────────────────────────────────────────────────────

  describe('getCategoryBySlug', () => {
    it('returns category when slug exists and is visible', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategory() as never);

      const result = await service.getCategoryBySlug('jewelry');

      expect(result.slug).toBe('jewelry');
    });

    it('throws NotFoundException for unknown slug', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getCategoryBySlug('no-such-slug')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when category exists but is not visible', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategory({ isVisible: false }) as never);

      await expect(service.getCategoryBySlug('jewelry')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getMegaMenu ──────────────────────────────────────────────────────────────

  describe('getMegaMenu', () => {
    const cachedMenus = [
      {
        navLabel: 'Jewelry',
        navSlug: 'jewelry',
        categoryId: 'cat-1',
        sortOrder: 0,
        isVisible: true,
        groups: [],
      },
    ];

    it('returns Redis-cached value when present (no DB call)', async () => {
      mockRedis.get.mockResolvedValue(cachedMenus);

      const result = await service.getMegaMenu();

      expect(result).toEqual(cachedMenus);
      expect(mockCategoryMenuModel.find).not.toHaveBeenCalled();
    });

    it('calls MongoDB and populates Redis cache on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      // Chain: .find().sort().lean().exec()
      const execMock = jest.fn().mockResolvedValue(cachedMenus);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
      mockCategoryMenuModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.getMegaMenu();

      expect(mockCategoryMenuModel.find).toHaveBeenCalledWith({ isVisible: true });
      expect(result).toEqual(cachedMenus);
      expect(mockRedis.set).toHaveBeenCalledWith('catalog:mega_menu', cachedMenus, 600);
    });
  });
});
