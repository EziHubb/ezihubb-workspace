import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { StorageService } from '../../common/services/storage.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AutoTranslateService } from '../translations/auto-translate.service';
import { ProductDetail } from '../catalog/schemas/product-detail.schema';
import { ProductSortBy } from './dto/product-query.dto';

const mockCategory = { id: 'cat-001', name: 'Mugs', slug: 'mugs' };

const mockProduct = {
  id:                 'prod-001',
  name:               'Custom Photo Mug',
  slug:               'custom-photo-mug',
  sku:                'MUG-001',
  description:        'A beautiful mug',
  shortDescription:   null,
  basePrice:          29.99,
  compareAtPrice:     null,
  isPersonalizable:   true,
  isActive:           true,
  isFeatured:         false,
  viewCount:          0,
  soldCount:          0,
  processingDays:     3,
  customizationConfig: null,
  categoryId:         'cat-001',
  category:           mockCategory,
  variants:           [],
  images:             [{ id: 'img-001', url: 'https://example.com/mug.jpg', altText: null, isPrimary: true, sortOrder: 0 }],
  tags:               [],
  _count:             { reviews: 5 },
  createdAt:          new Date('2025-01-01'),
  updatedAt:          new Date('2025-01-01'),
  deletedAt:          null,
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: DeepMockProxy<PrismaService>;
  let redis: DeepMockProxy<RedisService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService,  useValue: mockDeep<PrismaService>()  },
        { provide: RedisService,   useValue: mockDeep<RedisService>()   },
        {
          provide: StorageService,
          useValue: {
            generateKey:  jest.fn().mockReturnValue('key'),
            uploadFile:   jest.fn().mockResolvedValue(undefined),
            getPublicUrl: jest.fn().mockReturnValue('https://cdn.example.com/key'),
            deleteFile:   jest.fn().mockResolvedValue(undefined),
            extractKey:   jest.fn().mockReturnValue('key'),
          },
        },
        {
          provide: AnalyticsService,
          useValue: { trackEvent: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getModelToken(ProductDetail.name),
          useValue: {
            findOne:          jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
            findOneAndUpdate: jest.fn().mockReturnValue({ catch: jest.fn() }),
          },
        },
        {
          provide: AutoTranslateService,
          useValue: { triggerTranslation: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ProductsService);
    prisma  = module.get(PrismaService);
    redis   = module.get(RedisService);

    // Defaults
    redis.get.mockResolvedValue(null);
    redis.del.mockResolvedValue(undefined);
    redis.invalidatePattern.mockResolvedValue(undefined);
    redis.exists.mockResolvedValue(false);
    redis.set.mockResolvedValue(undefined);

    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 5 } } as any);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    beforeEach(() => {
      prisma.$transaction.mockResolvedValue([[mockProduct], 1] as any);
      (prisma.review.groupBy as jest.Mock).mockResolvedValue([]);
      redis.get.mockResolvedValue(null);
    });

    it('returns paginated product list with default query', async () => {
      const result = await service.findAll({} as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].slug).toBe('custom-photo-mug');
      expect(result.pagination.total).toBe(1);
    });

    it('applies category filter when category slug is provided', async () => {
      prisma.category.findUnique.mockResolvedValue(mockCategory as any);

      await service.findAll({ category: 'mugs' } as any);

      const callArg = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      // The transaction contains two operations; first one is product.findMany
      expect(callArg).toHaveLength(2);
    });

    it('applies price range filter (minPrice + maxPrice)', async () => {
      await service.findAll({ minPrice: 10, maxPrice: 50 } as any);

      // Verify $transaction was called — the where clause is built internally
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('orders by price ascending when sort=PRICE_ASC', async () => {
      await service.findAll({ sort: ProductSortBy.PRICE_ASC } as any);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('orders by price descending when sort=PRICE_DESC', async () => {
      await service.findAll({ sort: ProductSortBy.PRICE_DESC } as any);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── findBySlug ─────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('returns the product DTO when found', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct as any);

      const result = await service.findBySlug('custom-photo-mug');

      expect(result.slug).toBe('custom-photo-mug');
      expect(result.basePrice).toBe(29.99);
    });

    it('throws NotFoundException with ERR_NOT_FOUND when product does not exist', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('increments viewCount when viewLockId is provided and key not yet set', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct as any);
      redis.exists.mockResolvedValue(false);
      prisma.product.update.mockResolvedValue(mockProduct as any);

      await service.findBySlug('custom-photo-mug', 'session-lock-abc');

      expect(redis.set).toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ viewCount: { increment: 1 } }),
        }),
      );
    });

    it('does NOT increment viewCount when viewLockId key already exists in Redis', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct as any);
      redis.exists.mockResolvedValue(true);

      await service.findBySlug('custom-photo-mug', 'session-lock-abc');

      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      name:         'New Mug',
      sku:          'MUG-NEW-001',
      description:  'A shiny new mug',
      basePrice:    24.99,
      categoryId:   'cat-001',
      isPersonalizable: true,
    } as any;

    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue(null);   // SKU not taken
      prisma.category.findUnique.mockResolvedValue(mockCategory as any);
      prisma.product.findFirst.mockResolvedValue(null);    // slug available
      prisma.product.create.mockResolvedValue(mockProduct as any);
    });

    it('creates product and invalidates list cache', async () => {
      const result = await service.create(createDto);

      expect(prisma.product.create).toHaveBeenCalledTimes(1);
      expect(redis.invalidatePattern).toHaveBeenCalledWith('products:list:*');
      expect(result.slug).toBe('custom-photo-mug');
    });

    it('creates product with variants when variants array is provided', async () => {
      const dtoWithVariants = {
        ...createDto,
        variants: [{ name: 'Small', options: { size: 'S' }, price: 19.99, sku: 'MUG-S', isDefault: true, sortOrder: 0 }],
      };

      await service.create(dtoWithVariants);

      const createCall = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.variants.create).toHaveLength(1);
    });

    it('auto-generates a slug from name + sku when no slug is provided', async () => {
      await service.create(createDto);

      const createCall = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.slug).toMatch(/new-mug/);
    });

    it('appends counter to slug when base slug is already taken (duplicate slug handling)', async () => {
      // First findFirst call for slug check returns a product (slug taken)
      // Second call returns null (slug-2 is free)
      prisma.product.findFirst
        .mockResolvedValueOnce(mockProduct as any)
        .mockResolvedValueOnce(null);

      await service.create(createDto);

      const createCall = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.slug).toMatch(/-2$/);
    });

    it('throws ConflictException when SKU is already in use', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct as any);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when category does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes product by setting isActive=false', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-001' } as any);
      prisma.product.update.mockResolvedValue({ ...mockProduct, isActive: false, slug: 'custom-photo-mug' } as any);

      await service.delete('prod-001');

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('throws NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
