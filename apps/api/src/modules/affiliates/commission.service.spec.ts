import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CommissionStatus } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CommissionService } from './commission.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/queue.constants';

const mockOrder = {
  id: 'order-001',
  affiliateId: 'affil-001',
  subtotal: 100.00,
  discountAmount: 10.00,
  affiliateDiscountAmount: 5.00,
  couponCode: 'SAVE10',
  status: 'CONFIRMED',
};

const mockAffiliate = {
  id: 'affil-001',
  commissionRate: 0.12,
  email: 'affiliate@example.com',
  firstName: 'Alex',
  balance: 50.00,
  totalEarned: 200.00,
};

const mockSettings = {
  id: 'singleton',
  defaultRate: 0.10,
  lockDays: 14,
  minPayoutAmount: 50.00,
};

const mockCommission = {
  id: 'comm-001',
  affiliateId: 'affil-001',
  orderId: 'order-001',
  baseAmount: 90.00,
  rate: 0.12,
  amount: 10.80,
  status: CommissionStatus.PENDING,
  confirmedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
  order: { orderNumber: 'MLH-2025-00001' },
  affiliate: { email: 'affiliate@example.com', firstName: 'Alex' },
};

describe('CommissionService', () => {
  let service: CommissionService;
  let prisma: DeepMockProxy<PrismaService>;
  let commissionQueue: { add: jest.Mock; getJob: jest.Mock };
  let emailQueue: { add: jest.Mock };

  beforeEach(async () => {
    commissionQueue = {
      add:    jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
    };
    emailQueue = { add: jest.fn().mockResolvedValue({ id: 'job-2' }) };

    const module = await Test.createTestingModule({
      providers: [
        CommissionService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('https://dailydaisy.com') } },
        { provide: getQueueToken(QUEUES.AFFILIATE_COMMISSION), useValue: commissionQueue },
        { provide: getQueueToken(QUEUES.EMAIL), useValue: emailQueue },
      ],
    }).compile();

    service = module.get(CommissionService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createForOrder ─────────────────────────────────────────────────────────

  describe('createForOrder', () => {
    it('creates a commission record for an order with an affiliate referral', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder as any);
      prisma.affiliateCommission.findUnique.mockResolvedValue(null); // idempotency check — none exists
      prisma.affiliateAccount.findUnique.mockResolvedValue(mockAffiliate as any);
      prisma.affiliateSettings.findUnique.mockResolvedValue(mockSettings as any);
      prisma.affiliateCommission.create.mockResolvedValue(mockCommission as any);

      await service.createForOrder('order-001');

      // base = subtotal(100) - discountAmount(10) = 90; rate = 0.12; amount = 10.80
      expect(prisma.affiliateCommission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            affiliateId: 'affil-001',
            orderId:     'order-001',
            baseAmount:  90.00,
            rate:        0.12,
            amount:      10.80,
            status:      CommissionStatus.PENDING,
          }),
        }),
      );
    });

    it('does NOT create a commission when order has no affiliate referral', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        affiliateId: null,
      } as any);

      await service.createForOrder('order-001');

      expect(prisma.affiliateCommission.create).not.toHaveBeenCalled();
    });

    it('skips creation when a commission already exists for the order (idempotency)', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder as any);
      prisma.affiliateCommission.findUnique.mockResolvedValue(mockCommission as any);

      await service.createForOrder('order-001');

      expect(prisma.affiliateCommission.create).not.toHaveBeenCalled();
    });

    it('falls back to global default rate when affiliate has no custom rate', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder as any);
      prisma.affiliateCommission.findUnique.mockResolvedValue(null);
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        ...mockAffiliate,
        commissionRate: null,
      } as any);
      prisma.affiliateSettings.findUnique.mockResolvedValue(mockSettings as any);
      prisma.affiliateCommission.create.mockResolvedValue(mockCommission as any);

      await service.createForOrder('order-001');

      expect(prisma.affiliateCommission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rate: 0.10 }),
        }),
      );
    });
  });

  // ── confirmCommission ──────────────────────────────────────────────────────

  describe('confirmCommission', () => {
    it('transitions commission status from PENDING to CONFIRMED and credits balance', async () => {
      prisma.affiliateCommission.findUnique.mockResolvedValue(mockCommission as any);
      prisma.affiliateSettings.findUnique.mockResolvedValue(mockSettings as any);
      prisma.$transaction.mockImplementation((ops: any) =>
        Promise.resolve(Array.isArray(ops) ? ops.map(() => ({})) : ops),
      );
      // Re-fetch after update
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        ...mockAffiliate,
        balance: 60.80,
      } as any);

      await service.confirmCommission('order-001');

      expect(prisma.affiliateCommission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-001' },
          data:  expect.objectContaining({ status: CommissionStatus.CONFIRMED }),
        }),
      );
      expect(prisma.affiliateAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'affil-001' },
          data:  expect.objectContaining({
            balance:     { increment: 10.80 },
            totalEarned: { increment: 10.80 },
          }),
        }),
      );
    });

    it('does nothing when commission is not in PENDING status', async () => {
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        ...mockCommission,
        status: CommissionStatus.CONFIRMED,
      } as any);

      await service.confirmCommission('order-001');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does nothing when no commission exists for the order', async () => {
      prisma.affiliateCommission.findUnique.mockResolvedValue(null);

      await service.confirmCommission('order-001');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── cancelCommission ───────────────────────────────────────────────────────

  describe('cancelCommission', () => {
    it('transitions commission status from PENDING to CANCELLED', async () => {
      prisma.affiliateCommission.findUnique.mockResolvedValue(mockCommission as any);
      prisma.$transaction.mockImplementation((ops: any) =>
        Promise.resolve(Array.isArray(ops) ? ops.map(() => ({})) : ops),
      );

      await service.cancelCommission('order-001', 'Order refunded');

      expect(prisma.affiliateCommission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-001' },
          data:  expect.objectContaining({
            status:       CommissionStatus.CANCELLED,
            cancelReason: 'Order refunded',
          }),
        }),
      );
      // PENDING → CANCELLED should NOT decrement affiliate balance
      expect(prisma.affiliateAccount.update).not.toHaveBeenCalled();
    });

    it('decrements affiliate balance when cancelling a CONFIRMED commission', async () => {
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        ...mockCommission,
        status: CommissionStatus.CONFIRMED,
      } as any);
      prisma.$transaction.mockImplementation((ops: any) =>
        Promise.resolve(Array.isArray(ops) ? ops.map(() => ({})) : ops),
      );

      await service.cancelCommission('order-001', 'Refund requested');

      expect(prisma.affiliateAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'affil-001' },
          data:  expect.objectContaining({
            balance:     { decrement: mockCommission.amount },
            totalEarned: { decrement: mockCommission.amount },
          }),
        }),
      );
    });

    it('does nothing when no commission exists for the order', async () => {
      prisma.affiliateCommission.findUnique.mockResolvedValue(null);

      await service.cancelCommission('order-001', 'Refund');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('logs a warning and does nothing when commission is already PAID', async () => {
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        ...mockCommission,
        status: CommissionStatus.PAID,
      } as any);

      await service.cancelCommission('order-001', 'Refund');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── scheduleAutoConfirm ────────────────────────────────────────────────────

  describe('scheduleAutoConfirm', () => {
    it('enqueues an auto-confirm job with correct delay and jobId', async () => {
      prisma.affiliateSettings.findUnique.mockResolvedValue(mockSettings as any);

      await service.scheduleAutoConfirm('order-001');

      expect(commissionQueue.add).toHaveBeenCalledWith(
        'auto-confirm',
        { orderId: 'order-001' },
        expect.objectContaining({
          jobId: 'confirm-order-001',
          delay: 14 * 24 * 60 * 60 * 1_000,
        }),
      );
    });
  });
});
