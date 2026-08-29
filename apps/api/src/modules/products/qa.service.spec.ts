import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { ModerationService } from '../moderation/moderation.service';
import { QaService } from './qa.service';

function makePrismaMock() {
  return {
    product: {
      findFirst: jest.fn(),
    },
    productQuestion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeService(prisma: ReturnType<typeof makePrismaMock>) {
  const notifications = { queueEmail: jest.fn().mockResolvedValue(undefined) };
  const moderation = { queueQAModeration: jest.fn().mockResolvedValue(undefined) };
  return new QaService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    moderation as unknown as ModerationService,
  );
}

describe('QaService admin scoping', () => {
  it('shows non-spam questions immediately while masking unpublished draft answers', async () => {
    const prisma = makePrismaMock();
    prisma.product.findFirst.mockResolvedValue({ id: 'product-1' });
    prisma.productQuestion.findMany.mockResolvedValue([
      {
        id: 'question-1',
        question: 'Can this be customized?',
        askedByName: 'Buyer',
        answer: 'Draft answer',
        answeredAt: new Date('2026-08-29T00:00:00.000Z'),
        isPublished: false,
        upvotes: 0,
        createdAt: new Date('2026-08-29T00:00:00.000Z'),
      },
    ]);
    const service = makeService(prisma);

    await expect(service.getPublishedQAs('product-slug')).resolves.toEqual([
      expect.objectContaining({
        id: 'question-1',
        answer: null,
        answeredAt: null,
      }),
    ]);
    expect(prisma.productQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'product-1', isSpam: false },
      }),
    );
  });

  it('scopes the centralized question inbox to products owned by the active store', async () => {
    const prisma = makePrismaMock();
    prisma.productQuestion.findMany.mockResolvedValue([]);
    prisma.productQuestion.count.mockResolvedValue(0);
    const service = makeService(prisma);

    await service.getAdminQuestionInbox(
      { filter: 'unanswered', page: 1, limit: 24 },
      'store-1',
    );

    expect(prisma.productQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          answer: null,
          isSpam: false,
          product: { storeId: 'store-1' },
        }),
      }),
    );
    expect(prisma.productQuestion.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ product: { storeId: 'store-1' } }),
    });
  });

  it('scopes the unanswered sidebar badge to the active store', async () => {
    const prisma = makePrismaMock();
    prisma.productQuestion.count.mockResolvedValue(2);
    const service = makeService(prisma);

    await expect(service.getUnansweredCount('store-1')).resolves.toBe(2);

    expect(prisma.productQuestion.count).toHaveBeenCalledWith({
      where: {
        answer: null,
        isSpam: false,
        product: { storeId: 'store-1' },
      },
    });
  });

  it('rejects a question id that does not belong to the product in the route', async () => {
    const prisma = makePrismaMock();
    prisma.productQuestion.findUnique.mockResolvedValue({
      id: 'question-2',
      productId: 'product-2',
      product: { slug: 'other-product' },
    });
    const service = makeService(prisma);

    await expect(
      service.answerQuestion(
        'product-1',
        'question-2',
        { answer: 'No' },
        'https://ezihubb.com',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.productQuestion.update).not.toHaveBeenCalled();
  });
});
