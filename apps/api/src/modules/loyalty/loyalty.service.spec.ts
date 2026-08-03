import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { LoyaltyTxType } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { ConfigService } from '@nestjs/config';
import { QUEUES } from '../../queue/queue.constants';

const mockLoyaltyAccount = {
  id: 'acct-001',
  userId: 'user-001',
  pointsBalance: 500,
  pointsPending: 0,
  pointsLifetime: 1000,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockTransaction = {
  id: 'tx-001',
  accountId: 'acct-001',
  orderId: 'order-001',
  type: LoyaltyTxType.EARN,
  points: 100,
  description: 'Earned 100 pts from order',
  confirmedAt: null,
  createdAt: new Date('2025-01-15'),
};

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let prisma: DeepMockProxy<PrismaService>;
  let loyaltyQueue: { add: jest.Mock };
  let emailQueue: { add: jest.Mock };
  let pushService: jest.Mocked<Pick<PushService, 'notifyPointsConfirmed'>>;

  beforeEach(async () => {
    loyaltyQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    emailQueue = { add: jest.fn().mockResolvedValue({ id: 'job-2' }) };
    pushService = { notifyPointsConfirmed: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('https://ezihubb.com') } },
        { provide: PushService, useValue: pushService },
        { provide: getQueueToken(QUEUES.LOYALTY), useValue: loyaltyQueue },
        { provide: getQueueToken(QUEUES.EMAIL), useValue: emailQueue },
      ],
    }).compile();

    service = module.get(LoyaltyService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getOrCreateAccount ─────────────────────────────────────────────────────

  describe('getOrCreateAccount', () => {
    it('returns existing account when one exists for the user', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue(mockLoyaltyAccount as any);

      const result = await service.getOrCreateAccount('user-001');

      expect(result).toEqual(mockLoyaltyAccount);
      expect(prisma.loyaltyAccount.create).not.toHaveBeenCalled();
    });

    it('creates and returns a new account when none exists', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue(null);
      prisma.loyaltyAccount.create.mockResolvedValue(mockLoyaltyAccount as any);

      const result = await service.getOrCreateAccount('user-001');

      expect(prisma.loyaltyAccount.create).toHaveBeenCalledWith({
        data: { userId: 'user-001' },
      });
      expect(result.userId).toBe('user-001');
    });
  });

  // ── earnPoints ─────────────────────────────────────────────────────────────

  describe('earnPoints', () => {
    it('adds a EARN transaction and increments pointsPending + pointsLifetime', async () => {
      // getOrCreateAccount path
      prisma.loyaltyAccount.findUnique.mockResolvedValue(mockLoyaltyAccount as any);

      // $transaction receives an array of prisma promises — resolve them all
      prisma.$transaction.mockImplementation((ops: any) =>
        Promise.resolve(Array.isArray(ops) ? ops.map(() => ({})) : ops),
      );

      await service.earnPoints('user-001', 'order-001', 10.00); // 10 * 10 pts/$ = 100 pts

      expect(prisma.$transaction).toHaveBeenCalled();
      // Verify the loyaltyTransaction.create call included the right type
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'acct-001',
            orderId:   'order-001',
            type:      LoyaltyTxType.EARN,
            points:    100,
          }),
        }),
      );
    });

    it('does not create a transaction when earnableTotal yields 0 points', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue(mockLoyaltyAccount as any);

      await service.earnPoints('user-001', 'order-001', 0.05); // < 1 point

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── validateRedemption ─────────────────────────────────────────────────────

  describe('validateRedemption', () => {
    it('throws BadRequestException when user has insufficient points balance', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue({
        ...mockLoyaltyAccount,
        pointsBalance: 50,
      } as any);

      await expect(
        service.validateRedemption('user-001', 200, 100.00),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_LOYALTY_INSUFFICIENT_BALANCE' }),
        }),
      );
    });

    it('throws BadRequestException when points are below minimum redemption threshold', async () => {
      await expect(
        service.validateRedemption('user-001', 50, 100.00), // MIN_REDEEM_POINTS = 100
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_LOYALTY_MIN_REDEEM' }),
        }),
      );
    });

    it('returns the correct pointsDiscount for a valid redemption', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue({
        ...mockLoyaltyAccount,
        pointsBalance: 500,
      } as any);

      // Redeem 200 pts @ $0.01/pt = $2.00; order total $100, max 50% = $50 — well within limit
      const result = await service.validateRedemption('user-001', 200, 100.00);

      expect(result.pointsDiscount).toBe(2.00);
    });

    it('throws BadRequestException when requested discount exceeds 50% of order total', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue({
        ...mockLoyaltyAccount,
        pointsBalance: 10000,
      } as any);

      // 6000 pts * $0.01 = $60, but 50% of $100 = $50 — exceeds cap
      await expect(
        service.validateRedemption('user-001', 6000, 100.00),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_LOYALTY_MAX_REDEEM' }),
        }),
      );
    });
  });

  // ── redeemPoints ───────────────────────────────────────────────────────────

  describe('redeemPoints', () => {
    it('throws BadRequestException when atomic balance deduction affects 0 rows (insufficient balance)', async () => {
      // Simulate tx client
      const txClient = {
        loyaltyAccount: {
          updateMany:       jest.fn().mockResolvedValue({ count: 0 }),
          findUniqueOrThrow: jest.fn(),
        },
        loyaltyTransaction: { create: jest.fn() },
      };

      await expect(
        service.redeemPoints('user-001', 'order-001', 200, txClient as any),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_LOYALTY_INSUFFICIENT_BALANCE' }),
        }),
      );
      expect(txClient.loyaltyTransaction.create).not.toHaveBeenCalled();
    });

    it('creates a REDEEM transaction and deducts from balance when sufficient points exist', async () => {
      const txClient = {
        loyaltyAccount: {
          updateMany:        jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockLoyaltyAccount),
        },
        loyaltyTransaction: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      await service.redeemPoints('user-001', 'order-001', 200, txClient as any);

      expect(txClient.loyaltyAccount.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-001', pointsBalance: { gte: 200 } },
          data:  { pointsBalance: { decrement: 200 } },
        }),
      );
      expect(txClient.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'acct-001',
            orderId:   'order-001',
            type:      LoyaltyTxType.REDEEM,
            points:    -200,
          }),
        }),
      );
    });
  });

  // ── getAccountSummary ──────────────────────────────────────────────────────

  describe('getAccountSummary', () => {
    it('returns account balances and paginated transaction history', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue(mockLoyaltyAccount as any);
      prisma.loyaltyTransaction.findMany.mockResolvedValue([mockTransaction] as any);

      const result = await service.getAccountSummary('user-001');

      expect(result.pointsBalance).toBe(500);
      expect(result.pointsPending).toBe(0);
      expect(result.pointsLifetime).toBe(1000);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        id:     'tx-001',
        type:   LoyaltyTxType.EARN,
        points: 100,
      });
    });

    it('creates account automatically if one does not exist before returning summary', async () => {
      // findUnique returns null on getOrCreateAccount call, then create returns the account
      prisma.loyaltyAccount.findUnique
        .mockResolvedValueOnce(null)         // getOrCreateAccount check
        .mockResolvedValue(mockLoyaltyAccount as any); // subsequent calls
      prisma.loyaltyAccount.create.mockResolvedValue(mockLoyaltyAccount as any);
      prisma.loyaltyTransaction.findMany.mockResolvedValue([]);

      const result = await service.getAccountSummary('user-001');

      expect(prisma.loyaltyAccount.create).toHaveBeenCalled();
      expect(result.transactions).toEqual([]);
    });
  });

  // ── schedulePointsConfirm ──────────────────────────────────────────────────

  describe('schedulePointsConfirm', () => {
    it('adds a delayed job to the loyalty queue with the correct jobId', async () => {
      await service.schedulePointsConfirm('order-001', 'user-001');

      expect(loyaltyQueue.add).toHaveBeenCalledWith(
        'loyalty-confirm',
        { orderId: 'order-001', userId: 'user-001' },
        expect.objectContaining({
          jobId: 'loyalty-confirm-order-001',
          delay: 14 * 24 * 60 * 60 * 1_000,
        }),
      );
    });
  });
});
