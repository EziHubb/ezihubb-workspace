import type { PrismaService } from '../../prisma/prisma.service';
import type { StorageService } from '../../common/services/storage.service';
import type { RedisService } from '../../common/services/redis.service';
import type { ModerationService } from '../moderation/moderation.service';
import { ReviewsService } from './reviews.service';
import { ReviewStatus } from '@prisma/client';
import { ReviewQueryDto } from './dto/review-query.dto';

describe('Public review visibility', () => {
  it.each(Object.values(ReviewStatus))('never exposes hidden reviews for status=%s', async (status) => {
    const prisma = { product: { findFirst: jest.fn().mockResolvedValue({ id: 'p' }) },
      review: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const service = new ReviewsService(prisma as unknown as PrismaService, {} as StorageService, {} as RedisService, {} as never);
    await service.getProductReviews('slug', Object.assign(new ReviewQueryDto(), { status }));
    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 'p', status: ReviewStatus.APPROVED } }));
    expect(prisma.review.count).toHaveBeenCalledWith({ where: { productId: 'p', status: ReviewStatus.APPROVED } });
  });
});

function makePrismaMock() {
  return {
    product: { findFirst: jest.fn() },
    order: { findFirst: jest.fn() },
    review: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function reviewRecord(data: Record<string, unknown>) {
  return {
    id: 'review-1',
    adminReply: null,
    repliedAt: null,
    sellerReply: null,
    sellerRepliedAt: null,
    helpfulCount: 0,
    moderationStatus: 'PENDING',
    createdAt: new Date('2026-08-29T00:00:00.000Z'),
    ...data,
    user: {
      id: 'buyer-1',
      firstName: 'Test',
      lastName: 'Buyer',
      avatarUrl: null,
    },
  };
}

function makeService(
  prisma: ReturnType<typeof makePrismaMock>,
  moderationService = {
    queueReviewModeration: jest.fn().mockResolvedValue(undefined),
    queueReviewImageModeration: jest.fn().mockResolvedValue(undefined),
  },
) {
  const storage = {
    generateKey: jest.fn(),
    uploadFile: jest.fn(),
  };

  return {
    service: new ReviewsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      {} as RedisService,
      {} as never,
      moderationService as unknown as ModerationService,
    ),
    storage,
    moderationService,
  };
}

describe('ReviewsService store attribution', () => {
  it('attributes a new review to the store snapshot on the purchased order item', async () => {
    const prisma = makePrismaMock();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-1',
      storeId: 'current-store',
    });
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      items: [{ storeId: 'checkout-store' }],
    });
    prisma.review.findUnique.mockResolvedValue(null);
    prisma.review.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(reviewRecord(data)),
    );
    const { service } = makeService(prisma);

    await service.createReview('buyer-1', 'product-slug', {
      orderId: 'order-1',
      rating: 5,
      body: 'Excellent product',
    });

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storeId: 'checkout-store' }),
      }),
    );
  });

  it('falls back to the product owner for legacy order items without a store snapshot', async () => {
    const prisma = makePrismaMock();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-1',
      storeId: 'current-store',
    });
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      items: [{ storeId: null }],
    });
    prisma.review.findUnique.mockResolvedValue(null);
    prisma.review.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(reviewRecord(data)),
    );
    const { service } = makeService(prisma);

    await service.createReview('buyer-1', 'product-slug', {
      orderId: 'order-1',
      rating: 4,
      body: 'Good product',
    });

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storeId: 'current-store' }),
      }),
    );
  });

  it('queues image moderation after review photos are uploaded', async () => {
    const prisma = makePrismaMock();
    prisma.review.findUnique.mockResolvedValue({
      ...reviewRecord({
        userId: 'buyer-1',
        productId: 'product-1',
        orderId: 'order-1',
        rating: 5,
        title: null,
        body: 'Excellent product',
        imageUrls: [],
        status: 'PENDING',
        storeId: 'store-1',
      }),
    });
    prisma.review.update.mockImplementation(
      ({ data }: { data: { imageUrls: string[] } }) =>
        Promise.resolve(
          reviewRecord({
            userId: 'buyer-1',
            productId: 'product-1',
            orderId: 'order-1',
            rating: 5,
            title: null,
            body: 'Excellent product',
            imageUrls: data.imageUrls,
            status: 'PENDING',
            storeId: 'store-1',
          }),
        ),
    );
    const { service, storage, moderationService } = makeService(prisma);
    storage.generateKey.mockReturnValue('reviews/review-1/photo.jpg');
    storage.uploadFile.mockResolvedValue('https://cdn.example/photo.jpg');

    await service.uploadReviewImages('buyer-1', 'review-1', [
      {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('photo'),
      } as Express.Multer.File,
    ]);

    expect(moderationService.queueReviewImageModeration).toHaveBeenCalledWith(
      'review-1',
      ['https://cdn.example/photo.jpg'],
      'store-1',
    );
  });
});
