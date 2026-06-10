import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { getQueueToken } from '@nestjs/bullmq';
import { ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { StorageService } from '../../common/services/storage.service';
import { ReviewsService } from './reviews.service';
import { ReviewQueryDto } from './dto/review-query.dto';
import { QUEUES } from '../../queue/queue.constants';

const makeQuery = (overrides: Partial<ReviewQueryDto> = {}): ReviewQueryDto =>
  Object.assign(new ReviewQueryDto(), { page: 1, limit: 10, ...overrides });

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockStorage = {
  generateKey: jest.fn(),
  uploadFile: jest.fn(),
};

const mockEmailQueue = {
  add: jest.fn().mockResolvedValue(undefined),
};

const makeUser = () => ({
  id: 'user-1',
  firstName: 'Alice',
  lastName: 'Smith',
  avatarUrl: null,
});

const makeReview = (overrides: Record<string, unknown> = {}) => ({
  id: 'review-1',
  userId: 'user-1',
  productId: 'prod-1',
  orderId: 'order-1',
  rating: 5,
  title: 'Great product',
  body: 'Loved it!',
  imageUrls: [] as string[],
  status: ReviewStatus.PENDING,
  adminReply: null,
  repliedAt: null,
  createdAt: new Date('2024-06-01'),
  user: makeUser(),
  ...overrides,
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: RedisService, useValue: mockRedis },
        { provide: getQueueToken(QUEUES.EMAIL), useValue: mockEmailQueue },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);

    jest.clearAllMocks();
  });

  // ─── createReview ────────────────────────────────────────────────────────────

  describe('createReview', () => {
    const dto = { orderId: 'order-1', rating: 5, title: 'Great!', body: 'Loved it' };

    it('throws NotFoundException when product slug is unknown', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.createReview('user-1', 'unknown-slug', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user has no qualifying delivered/completed order', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' } as never);
      prisma.order.findFirst.mockResolvedValue(null); // no qualifying order

      await expect(
        service.createReview('user-1', 'product-slug', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when user has already reviewed this product for the same order', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' } as never);
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1' } as never);
      prisma.review.findUnique.mockResolvedValue(makeReview() as never); // duplicate

      await expect(
        service.createReview('user-1', 'product-slug', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates and returns review when all guards pass', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' } as never);
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1' } as never);
      prisma.review.findUnique.mockResolvedValue(null); // no duplicate
      prisma.review.create.mockResolvedValue(makeReview() as never);

      const result = await service.createReview('user-1', 'product-slug', dto);

      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            productId: 'prod-1',
            orderId: 'order-1',
            rating: 5,
            status: ReviewStatus.PENDING,
          }),
        }),
      );
      expect(result.id).toBe('review-1');
      expect(result.status).toBe(ReviewStatus.PENDING);
    });
  });

  // ─── getProductReviews ────────────────────────────────────────────────────────

  describe('getProductReviews', () => {
    it('returns paginated list of approved reviews for a product slug', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' } as never);
      // findMany and count called via Promise.all
      prisma.review.findMany.mockResolvedValue([makeReview({ status: ReviewStatus.APPROVED })] as never);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getProductReviews('product-slug', makeQuery());

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('throws NotFoundException for unknown product slug', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.getProductReviews('bad-slug', makeQuery()),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes pagination parameters to Prisma query', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' } as never);
      prisma.review.findMany.mockResolvedValue([] as never);
      prisma.review.count.mockResolvedValue(0);

      await service.getProductReviews('product-slug', makeQuery({ page: 2, limit: 5 }));

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  // ─── approveReview (moderateReview) ──────────────────────────────────────────

  describe('approveReview', () => {
    it('flips status to APPROVED and invalidates cache', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      const approvedReview = makeReview({ status: ReviewStatus.APPROVED });

      prisma.review.findUnique.mockResolvedValue(pendingReview as never);
      prisma.review.update.mockResolvedValue(approvedReview as never);
      mockRedis.del.mockResolvedValue(undefined);

      const result = await service.approveReview('review-1');

      expect(prisma.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'review-1' },
          data: { status: ReviewStatus.APPROVED },
        }),
      );
      expect(result.status).toBe(ReviewStatus.APPROVED);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('throws NotFoundException when review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.approveReview('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── hideReview ────────────────────────────────────────────────────────────────

  describe('hideReview', () => {
    it('flips status to HIDDEN and invalidates cache', async () => {
      const existing = makeReview({ status: ReviewStatus.APPROVED });
      const hidden = makeReview({ status: ReviewStatus.HIDDEN });

      prisma.review.findUnique.mockResolvedValue(existing as never);
      prisma.review.update.mockResolvedValue(hidden as never);
      mockRedis.del.mockResolvedValue(undefined);

      const result = await service.hideReview('review-1');

      expect(result.status).toBe(ReviewStatus.HIDDEN);
    });
  });
});
