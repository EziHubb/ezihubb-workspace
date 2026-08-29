import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { ModerationService } from '../moderation/moderation.service';
import { QaService } from './qa.service';

function makePrismaMock() {
  return {
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
