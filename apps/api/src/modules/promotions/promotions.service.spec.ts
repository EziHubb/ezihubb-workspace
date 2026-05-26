import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DiscountType } from '@prisma/client';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../../prisma/prisma.service';

const buildPromotion = (overrides: Record<string, unknown> = {}) => ({
  id:             'promo-001',
  code:           'SAVE10',
  type:           DiscountType.PERCENTAGE,
  value:          10 as unknown as any,
  minOrderAmount: null,
  maxUses:        null,
  maxUsesPerUser: 1,
  currentUses:    0,
  isActive:       true,
  startsAt:       null,
  expiresAt:      null,
  description:    '10% off everything',
  createdAt:      new Date(),
  ...overrides,
});

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get(PromotionsService);
    prisma  = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── validateCoupon ─────────────────────────────────────────────────────────

  describe('validateCoupon', () => {
    it('returns valid result with calculated discount for a valid coupon', async () => {
      prisma.promotion.findUnique.mockResolvedValue(buildPromotion() as any);
      prisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.validateCoupon({ code: 'SAVE10', orderTotal: 100 }, 'user-001');

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10); // 10% of 100
    });

    it('throws ERR_COUPON_INVALID when coupon code does not exist', async () => {
      prisma.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.validateCoupon({ code: 'FAKE', orderTotal: 100 }),
      ).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_INVALID' }) }),
      );
    });

    it('throws ERR_COUPON_INVALID when coupon exists but is inactive', async () => {
      prisma.promotion.findUnique.mockResolvedValue(buildPromotion({ isActive: false }) as any);

      await expect(
        service.validateCoupon({ code: 'SAVE10', orderTotal: 100 }),
      ).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_INVALID' }) }),
      );
    });

    it('throws ERR_COUPON_EXPIRED when the coupon expiry date has passed', async () => {
      const expiredPromo = buildPromotion({ expiresAt: new Date(Date.now() - 86_400_000) });
      prisma.promotion.findUnique.mockResolvedValue(expiredPromo as any);

      await expect(
        service.validateCoupon({ code: 'SAVE10', orderTotal: 100 }),
      ).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_EXPIRED' }) }),
      );
    });

    it('throws ERR_COUPON_EXHAUSTED when max usage limit has been reached', async () => {
      const exhaustedPromo = buildPromotion({ maxUses: 100, currentUses: 100 });
      prisma.promotion.findUnique.mockResolvedValue(exhaustedPromo as any);

      await expect(
        service.validateCoupon({ code: 'SAVE10', orderTotal: 100 }),
      ).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_EXHAUSTED' }) }),
      );
    });

    it('throws ERR_COUPON_MIN_ORDER when order total is below the minimum required', async () => {
      const minOrderPromo = buildPromotion({ minOrderAmount: 50 as unknown as any });
      prisma.promotion.findUnique.mockResolvedValue(minOrderPromo as any);

      await expect(
        service.validateCoupon({ code: 'SAVE10', orderTotal: 30 }),
      ).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_MIN_ORDER' }) }),
      );
    });

    it('throws ERR_COUPON_USER_LIMIT when user has already used the coupon maxUsesPerUser times', async () => {
      prisma.promotion.findUnique.mockResolvedValue(buildPromotion({ maxUsesPerUser: 1 }) as any);
      prisma.promotionUsage.count.mockResolvedValue(1);

      await expect(
        service.validateCoupon({ code: 'SAVE10', orderTotal: 100 }, 'user-001'),
      ).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_USER_LIMIT' }) }),
      );
    });

    it('calculates fixed discount correctly for FIXED_AMOUNT type', async () => {
      const fixedPromo = buildPromotion({ type: DiscountType.FIXED_AMOUNT, value: 15 as unknown as any });
      prisma.promotion.findUnique.mockResolvedValue(fixedPromo as any);

      const result = await service.validateCoupon({ code: 'SAVE15', orderTotal: 100 });

      expect(result.discountAmount).toBe(15);
    });

    it('caps fixed discount at the order total (does not produce negative totals)', async () => {
      const fixedPromo = buildPromotion({ type: DiscountType.FIXED_AMOUNT, value: 200 as unknown as any });
      prisma.promotion.findUnique.mockResolvedValue(fixedPromo as any);

      const result = await service.validateCoupon({ code: 'BIGDISCOUNT', orderTotal: 50 });

      expect(result.discountAmount).toBe(50); // capped at order total
    });
  });

  // ── useCoupon ──────────────────────────────────────────────────────────────

  describe('useCoupon', () => {
    it('executes atomic UPDATE and resolves when 1 row is affected', async () => {
      const mockTx = { $executeRaw: jest.fn().mockResolvedValue(1) } as any;

      await expect(service.useCoupon('SAVE10', mockTx)).resolves.toBeUndefined();
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it('throws ERR_COUPON_RACE when atomic UPDATE affects 0 rows (concurrency conflict)', async () => {
      const mockTx = { $executeRaw: jest.fn().mockResolvedValue(0) } as any;

      await expect(service.useCoupon('SAVE10', mockTx)).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_RACE' }) }),
      );
    });

    it('handles concurrent usage by relying on row-level conditional increment', async () => {
      // Simulate two concurrent calls: first succeeds (1 row), second fails (0 rows = exhausted)
      const mockTx1 = { $executeRaw: jest.fn().mockResolvedValue(1) } as any;
      const mockTx2 = { $executeRaw: jest.fn().mockResolvedValue(0) } as any;

      await expect(service.useCoupon('LIMITED1', mockTx1)).resolves.toBeUndefined();
      await expect(service.useCoupon('LIMITED1', mockTx2)).rejects.toThrow(BadRequestException);
    });
  });

  // ── calcDiscount (utility method) ──────────────────────────────────────────

  describe('calcDiscount', () => {
    it('computes percentage discount correctly', () => {
      expect(service.calcDiscount(DiscountType.PERCENTAGE, 10, 200)).toBe(20);
    });

    it('computes fixed discount correctly', () => {
      expect(service.calcDiscount(DiscountType.FIXED_AMOUNT, 25, 200)).toBe(25);
    });

    it('returns 0 for FREE_SHIPPING type (handled separately at checkout)', () => {
      expect(service.calcDiscount(DiscountType.FREE_SHIPPING, 0, 200)).toBe(0);
    });
  });
});
