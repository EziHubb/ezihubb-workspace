import { SubscriptionsService } from './subscriptions.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const PAST = new Date('2026-08-01T00:00:00.000Z');
const FUTURE = new Date('2026-09-01T00:00:00.000Z');

function makePrismaMock() {
  return {
    storeSubscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    platformSettings: {
      // grant() reads the singleton via upsert (same on-demand-create pattern
      // as StoresService.getPlatformSettings), not findUniqueOrThrow.
      upsert: jest.fn(),
    },
  };
}

describe('SubscriptionsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SubscriptionsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    prisma = makePrismaMock();
    service = new SubscriptionsService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.useRealTimers());

  describe('grant', () => {
    it('creates a subscription when the store has never had one', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue(null);
      prisma.platformSettings.upsert.mockResolvedValue({ plusMonthlyPrice: 5, plusAnnualPrice: null });
      prisma.storeSubscription.upsert.mockResolvedValue({ id: 'sub_1', storeId: 'store_1', status: 'ACTIVE' });

      await service.grant('store_1', 'MONTHLY', 'admin_1');

      expect(prisma.storeSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storeId: 'store_1' },
          create: expect.objectContaining({ storeId: 'store_1', status: 'ACTIVE', cycle: 'MONTHLY', priceAtPurchase: 5, grantedByUserId: 'admin_1' }),
        }),
      );
    });

    it('rejects with 409 ERR_ALREADY_HAS_PLUS when the store already has an active, unexpired subscription', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: FUTURE });

      await expect(service.grant('store_1', 'MONTHLY', 'admin_1')).rejects.toThrow(ConflictException);
      expect(prisma.storeSubscription.upsert).not.toHaveBeenCalled();
    });

    it('allows granting again once the previous subscription has expired (upsert update branch)', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: PAST });
      prisma.platformSettings.upsert.mockResolvedValue({ plusMonthlyPrice: 5, plusAnnualPrice: null });
      prisma.storeSubscription.upsert.mockResolvedValue({ id: 'sub_1', storeId: 'store_1', status: 'ACTIVE' });

      await service.grant('store_1', 'MONTHLY', 'admin_1');

      expect(prisma.storeSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'ACTIVE', cancelAtPeriodEnd: false, cancelledAt: null }),
        }),
      );
    });

    it('rejects with 400 ERR_ANNUAL_PRICE_NOT_SET when granting ANNUAL while plusAnnualPrice is null', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue(null);
      prisma.platformSettings.upsert.mockResolvedValue({ plusMonthlyPrice: 5, plusAnnualPrice: null });

      await expect(service.grant('store_1', 'ANNUAL', 'admin_1')).rejects.toThrow(BadRequestException);
      expect(prisma.storeSubscription.upsert).not.toHaveBeenCalled();
    });

    it('uses the CURRENT plusMonthlyPrice from PlatformSettings at grant time, not a hardcoded 5.00 — proves no fallback exists', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue(null);
      // Admin has changed the list price to 8 before this call.
      prisma.platformSettings.upsert.mockResolvedValue({ plusMonthlyPrice: 8, plusAnnualPrice: null });
      prisma.storeSubscription.upsert.mockResolvedValue({ id: 'sub_1', storeId: 'store_1', status: 'ACTIVE' });

      await service.grant('store_1', 'MONTHLY', 'admin_1');

      expect(prisma.storeSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ priceAtPurchase: 8 }),
        }),
      );
    });
  });

  describe('extend', () => {
    it('throws NotFoundException (ERR_NO_SUBSCRIPTION), not a raw Prisma error, when the store has never had a subscription', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue(null);

      await expect(service.extend('store_1', 1, 'admin_1')).rejects.toThrow(NotFoundException);
      await expect(service.extend('store_1', 1, 'admin_1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ERR_NO_SUBSCRIPTION' }),
      });
    });

    it('stacks the extension on top of the existing currentPeriodEnd when still entitled', async () => {
      const currentPeriodEnd = new Date('2026-09-10T00:00:00.000Z');
      prisma.storeSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd });
      prisma.storeSubscription.update.mockResolvedValue({});

      await service.extend('store_1', 1, 'admin_1');

      const call = prisma.storeSubscription.update.mock.calls[0][0];
      expect(call.data.currentPeriodEnd.toISOString()).toBe('2026-10-10T00:00:00.000Z'); // +1 month from the OLD end, not from now
    });

    it('extends from now (not from a stale past date) when the existing subscription already expired', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: PAST });
      prisma.storeSubscription.update.mockResolvedValue({});

      await service.extend('store_1', 1, 'admin_1');

      const call = prisma.storeSubscription.update.mock.calls[0][0];
      // +1 month from NOW (2026-08-18), not from PAST (2026-08-01)
      expect(call.data.currentPeriodEnd.toISOString()).toBe('2026-09-18T12:00:00.000Z');
    });

    it('correctly clamps end-of-month: Jan 31 + 1 month -> Feb 28 (non-leap year)', async () => {
      const jan31 = new Date('2027-01-31T00:00:00.000Z'); // 2027 is not a leap year
      prisma.storeSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: jan31 });
      prisma.storeSubscription.update.mockResolvedValue({});

      await service.extend('store_1', 1, 'admin_1');

      const call = prisma.storeSubscription.update.mock.calls[0][0];
      expect(call.data.currentPeriodEnd.toISOString()).toBe('2027-02-28T00:00:00.000Z');
    });

    it('correctly clamps end-of-month in a leap year: Jan 31 + 1 month -> Feb 29', async () => {
      const jan31 = new Date('2028-01-31T00:00:00.000Z'); // 2028 IS a leap year
      prisma.storeSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: jan31 });
      prisma.storeSubscription.update.mockResolvedValue({});

      await service.extend('store_1', 1, 'admin_1');

      const call = prisma.storeSubscription.update.mock.calls[0][0];
      expect(call.data.currentPeriodEnd.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    });

    it('never touches priceAtPurchase — a price change after grant does not retroactively affect an existing subscription', async () => {
      // Subscription was granted earlier at the OLD price (priceAtPurchase
      // already stored on the row — extend() has no reason to read it back).
      prisma.storeSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: FUTURE, priceAtPurchase: 5 });
      prisma.storeSubscription.update.mockResolvedValue({});

      await service.extend('store_1', 1, 'admin_1');

      // extend() doesn't even read PlatformSettings — the current list price
      // (however it's changed since) is structurally irrelevant to it.
      expect(prisma.platformSettings.upsert).not.toHaveBeenCalled();
      const call = prisma.storeSubscription.update.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('priceAtPurchase');
    });
  });

  describe('revokeImmediately', () => {
    it('throws NotFoundException (ERR_NO_SUBSCRIPTION), not a raw Prisma error, when the store has never had a subscription', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue(null);
      await expect(service.revokeImmediately('store_1')).rejects.toThrow(NotFoundException);
    });

    it('sets status to CANCELLED and stamps cancelledAt', async () => {
      prisma.storeSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: FUTURE });
      prisma.storeSubscription.update.mockResolvedValue({});

      await service.revokeImmediately('store_1');

      const call = prisma.storeSubscription.update.mock.calls[0][0];
      expect(call.data.status).toBe('CANCELLED');
      expect(call.data.cancelledAt).toEqual(NOW);
    });
  });
});
