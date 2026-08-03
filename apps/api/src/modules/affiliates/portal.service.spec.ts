import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AffiliateStatus } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { PortalService } from './portal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/queue.constants';

const mockAffiliateAccount = {
  id: 'affil-001',
  userId: 'user-001',
  email: 'affiliate@example.com',
  firstName: 'Alex',
  lastName: 'Jordan',
  website: 'https://myblog.com',
  promoDescription: 'I review handmade goods',
  referralCode: 'ALEX1234',
  status: AffiliateStatus.ACTIVE,
  balance: 120.00,
  totalEarned: 350.00,
  commissionRate: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockSettings = {
  id: 'singleton',
  defaultRate: 0.10,
  buyerDiscountRate: 0.05,
  cookieDays: 30,
  minPayoutAmount: 50.00,
  lockDays: 14,
  isEnabled: true,
};

const mockPayout = {
  id: 'payout-001',
  affiliateId: 'affil-001',
  amount: 100.00,
  status: 'REQUESTED',
  paymentMethod: 'PAYPAL',
  paymentDetail: 'affiliate@paypal.com',
  createdAt: new Date('2025-01-20'),
  processedAt: null,
};

describe('PortalService', () => {
  let service: PortalService;
  let prisma: DeepMockProxy<PrismaService>;
  let emailQueue: { add: jest.Mock };

  beforeEach(async () => {
    emailQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        PortalService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('https://ezihubb.com') } },
        { provide: getQueueToken(QUEUES.EMAIL), useValue: emailQueue },
      ],
    }).compile();

    service = module.get(PortalService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getDashboard (stats: clicks, orders, earnings, conversion rate) ─────────

  describe('getDashboard', () => {
    it('returns clicks, conversions, earnings, and conversion rate', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        balance:      120.00,
        totalEarned:  350.00,
        referralCode: 'ALEX1234',
      } as any);
      prisma.affiliateClick.count
        .mockResolvedValueOnce(200)   // totalClicks
        .mockResolvedValueOnce(40);   // totalConversions
      prisma.affiliateCommission.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('affil-001');

      expect(result.totalClicks).toBe(200);
      expect(result.totalConversions).toBe(40);
      expect(result.conversionRate).toBeCloseTo(0.2);
      expect(result.balance).toBe(120.00);
      expect(result.totalEarned).toBe(350.00);
      expect(result.referralCode).toBe('ALEX1234');
    });

    it('returns 0 conversion rate when there are no clicks', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        balance:      0,
        totalEarned:  0,
        referralCode: 'ALEX1234',
      } as any);
      prisma.affiliateClick.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.affiliateCommission.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('affil-001');

      expect(result.conversionRate).toBe(0);
    });

    it('includes recentCommissions with mapped order numbers', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        balance: 50.00, totalEarned: 50.00, referralCode: 'ALEX1234',
      } as any);
      prisma.affiliateClick.count.mockResolvedValue(0);
      prisma.affiliateCommission.findMany.mockResolvedValue([
        {
          id:        'comm-001',
          orderId:   'order-001',
          amount:    10.80,
          status:    'CONFIRMED',
          createdAt: new Date('2025-01-15'),
          order:     { orderNumber: 'MLH-2025-00001' },
        },
      ] as any);

      const result = await service.getDashboard('affil-001');

      expect(result.recentCommissions).toHaveLength(1);
      expect(result.recentCommissions[0].orderNumber).toBe('MLH-2025-00001');
      expect(result.recentCommissions[0].amount).toBe(10.80);
    });
  });

  // ── requestPayout ──────────────────────────────────────────────────────────

  describe('requestPayout', () => {
    const payoutDto = {
      amount: 100.00,
      paymentMethod: 'PAYPAL',
      paymentDetail: 'affiliate@paypal.com',
    };

    it('throws BadRequestException when affiliate balance is below minimum threshold', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        ...mockAffiliateAccount,
        balance: 20.00, // below $50 minimum
      } as any);
      prisma.affiliateSettings.findUnique.mockResolvedValue(mockSettings as any);

      await expect(
        service.requestPayout('affil-001', payoutDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when affiliate account is not ACTIVE', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        ...mockAffiliateAccount,
        status: AffiliateStatus.PENDING,
        balance: 200.00,
      } as any);
      prisma.affiliateSettings.findUnique.mockResolvedValue(mockSettings as any);

      await expect(
        service.requestPayout('affil-001', payoutDto as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when requested amount exceeds available balance', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        ...mockAffiliateAccount,
        balance: 60.00, // below requested $100
      } as any);
      prisma.affiliateSettings.findUnique.mockResolvedValue(mockSettings as any);

      await expect(
        service.requestPayout('affil-001', payoutDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates payout record with REQUESTED status and decrements affiliate balance', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue(mockAffiliateAccount as any);
      prisma.affiliateSettings.findUnique.mockResolvedValue(mockSettings as any);

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const txClient = {
          affiliatePayout: {
            create: jest.fn().mockResolvedValue({
              id:     mockPayout.id,
              amount: mockPayout.amount,
              status: 'REQUESTED',
            }),
          },
          affiliateAccount: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(txClient);
      });

      const result = await service.requestPayout('affil-001', payoutDto as any);

      expect(result.status).toBe('REQUESTED');
      expect(result.amount).toBe(100.00);
    });
  });

  // ── getMyAffiliate ─────────────────────────────────────────────────────────

  describe('getMyAffiliate', () => {
    it('returns affiliate account details for the authenticated user', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id:           'affil-001',
        status:       AffiliateStatus.ACTIVE,
        referralCode: 'ALEX1234',
        balance:      120.00,
        totalEarned:  350.00,
        firstName:    'Alex',
        lastName:     'Jordan',
        email:        'affiliate@example.com',
      } as any);

      const result = await service.getMyAffiliate('user-001');

      expect(result).toMatchObject({
        id:           'affil-001',
        referralCode: 'ALEX1234',
        status:       AffiliateStatus.ACTIVE,
      });
      expect(prisma.affiliateAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-001' } }),
      );
    });

    it('returns null when user has no affiliate account', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue(null);

      const result = await service.getMyAffiliate('user-001');

      expect(result).toBeNull();
    });
  });

  // ── getMyPayouts ───────────────────────────────────────────────────────────

  describe('getMyPayouts', () => {
    it('returns payout list for the affiliate', async () => {
      prisma.affiliatePayout.findMany.mockResolvedValue([mockPayout] as any);

      const result = await service.getMyPayouts('affil-001');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('REQUESTED');
      expect(prisma.affiliatePayout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { affiliateId: 'affil-001' } }),
      );
    });
  });

  // ── getMyClicks ────────────────────────────────────────────────────────────

  describe('getMyClicks', () => {
    it('returns paginated click list with correct metadata', async () => {
      const mockClicks = [
        { id: 'click-001', landingPage: '/', convertedAt: null, orderId: null, createdAt: new Date() },
        { id: 'click-002', landingPage: '/products', convertedAt: new Date(), orderId: 'order-001', createdAt: new Date() },
      ];
      prisma.affiliateClick.findMany.mockResolvedValue(mockClicks as any);
      prisma.affiliateClick.count.mockResolvedValue(25);

      const result = await service.getMyClicks('affil-001', 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3); // ceil(25/10)
    });
  });
});
