import { StoresService } from './stores.service';
import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EntitlementsService } from '../subscriptions/entitlements.service';

function makePrismaMock() {
  return {
    store: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    platformSettings: {
      upsert: jest.fn(),
    },
  };
}

describe('StoresService.adminGetStore — Decimal response normalization', () => {
  it('returns numeric rating and revenue values for admin clients', async () => {
    const prisma = makePrismaMock();
    prisma.store.findUnique.mockResolvedValue({
      id: 'store_1',
      ownerId: 'owner_1',
      rating: '4.75',
      totalRevenue: '123.45',
      _count: { followers: 2 },
    });
    prisma.product.count.mockResolvedValue(3);
    const service = makeService(prisma, jest.fn());

    const result = await service.adminGetStore('store_1');

    expect(result).toEqual(expect.objectContaining({
      rating: 4.75,
      totalRevenue: 123.45,
      totalProducts: 3,
      followerCount: 2,
    }));
  });
});

function makeService(prisma: ReturnType<typeof makePrismaMock>, canUseFeature: jest.Mock) {
  return new StoresService(
    prisma as unknown as PrismaService,
    {} as any, // emailQueue — unused by the two methods under test
    {} as any, // storageService
    {} as any, // redis — unused as long as tests don't pass a viewLockId
    {} as any, // analyticsService
    { canUseFeature } as unknown as EntitlementsService,
    undefined, // moderationService — optional, unused unless bannerUrl/logoUrl is set
  );
}

describe('StoresService.adminUpdateStore — Plus gate on colorTheme', () => {
  it('rejects with 403 ERR_PLUS_REQUIRED when setting colorTheme without an active Plus subscription', async () => {
    const prisma = makePrismaMock();
    prisma.store.findUnique.mockResolvedValue({ id: 'store_1' });
    const canUseFeature = jest.fn().mockResolvedValue(false);
    const service = makeService(prisma, canUseFeature);

    await expect(service.adminUpdateStore('store_1', { colorTheme: 'burgundy' })).rejects.toThrow(ForbiddenException);
    await expect(service.adminUpdateStore('store_1', { colorTheme: 'burgundy' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ERR_PLUS_REQUIRED' }),
    });
    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  it('allows setting colorTheme when the store has an active Plus subscription', async () => {
    const prisma = makePrismaMock();
    prisma.store.findUnique.mockResolvedValue({ id: 'store_1' });
    prisma.store.update.mockResolvedValue({ id: 'store_1', colorTheme: 'burgundy' });
    const canUseFeature = jest.fn().mockResolvedValue(true);
    const service = makeService(prisma, canUseFeature);

    await service.adminUpdateStore('store_1', { colorTheme: 'burgundy' });

    expect(prisma.store.update).toHaveBeenCalled();
  });

  it('does NOT call the entitlement check at all when colorTheme is not part of the update (other fields untouched)', async () => {
    const prisma = makePrismaMock();
    prisma.store.findUnique.mockResolvedValue({ id: 'store_1' });
    prisma.store.update.mockResolvedValue({ id: 'store_1' });
    const canUseFeature = jest.fn();
    const service = makeService(prisma, canUseFeature);

    await service.adminUpdateStore('store_1', { tagline: 'hello' });

    expect(canUseFeature).not.toHaveBeenCalled();
    expect(prisma.store.update).toHaveBeenCalled();
  });
});

describe('StoresService.getStoreBySlug — Plus gate on colorTheme only, featuredProductIds always free', () => {
  it('nulls out colorTheme but returns featuredProductIds unchanged when the store has no Plus', async () => {
    const prisma = makePrismaMock();
    (prisma.store as any).findUnique.mockResolvedValue({
      id: 'store_1', slug: 'my-shop', name: 'My Shop', description: null,
      logoUrl: null, bannerUrl: null, status: 'ACTIVE',
      totalOrders: 0, rating: 0, createdAt: new Date(), verifiedAt: null,
      shareSaveEnabled: false,
      colorTheme: 'burgundy',
      featuredProductIds: ['p1', 'p2', 'p3'],
      subscription: null, // no Plus at all
      _count: { products: 3, followers: 0 },
    });
    const service = makeService(prisma, jest.fn());

    const result = await service.getStoreBySlug('my-shop');

    expect(result.colorTheme).toBeNull();
    expect(result.featuredProductIds).toEqual(['p1', 'p2', 'p3']); // NOT gated — the exact bug that was caught in review
  });

  it('returns colorTheme unchanged when the store has an active Plus subscription', async () => {
    const prisma = makePrismaMock();
    (prisma.store as any).findUnique.mockResolvedValue({
      id: 'store_1', slug: 'my-shop', name: 'My Shop', description: null,
      logoUrl: null, bannerUrl: null, status: 'ACTIVE',
      totalOrders: 0, rating: 0, createdAt: new Date(), verifiedAt: null,
      shareSaveEnabled: false,
      colorTheme: 'burgundy',
      featuredProductIds: ['p1'],
      subscription: { status: 'ACTIVE', currentPeriodEnd: new Date('2099-01-01') },
      _count: { products: 1, followers: 0 },
    });
    const service = makeService(prisma, jest.fn());

    const result = await service.getStoreBySlug('my-shop');

    expect(result.colorTheme).toBe('burgundy');
    expect(result.featuredProductIds).toEqual(['p1']);
  });

  it('does not leak the raw `subscription` object in the response', async () => {
    const prisma = makePrismaMock();
    (prisma.store as any).findUnique.mockResolvedValue({
      id: 'store_1', slug: 'my-shop', name: 'My Shop', description: null,
      logoUrl: null, bannerUrl: null, status: 'ACTIVE',
      totalOrders: 0, rating: 0, createdAt: new Date(), verifiedAt: null,
      shareSaveEnabled: false,
      colorTheme: null,
      featuredProductIds: [],
      subscription: { status: 'ACTIVE', currentPeriodEnd: new Date('2099-01-01') },
      _count: { products: 0, followers: 0 },
    });
    const service = makeService(prisma, jest.fn());

    const result = await service.getStoreBySlug('my-shop');

    expect(result).not.toHaveProperty('subscription');
  });
});

describe('StoresService.updatePlatformSettings — plusMonthlyPrice / plusAnnualPrice reach Prisma untouched', () => {
  it('forwards a new plusMonthlyPrice into the upsert update payload', async () => {
    const prisma = makePrismaMock();
    prisma.platformSettings.upsert.mockResolvedValue({ id: 'singleton', plusMonthlyPrice: 8 });
    const service = makeService(prisma, jest.fn());

    await service.updatePlatformSettings({ plusMonthlyPrice: 8 });

    expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'singleton' },
        update: expect.objectContaining({ plusMonthlyPrice: 8 }),
      }),
    );
  });

  it('forwards an explicit null plusAnnualPrice into the upsert update payload (clears it, not dropped)', async () => {
    const prisma = makePrismaMock();
    prisma.platformSettings.upsert.mockResolvedValue({ id: 'singleton', plusAnnualPrice: null });
    const service = makeService(prisma, jest.fn());

    await service.updatePlatformSettings({ plusAnnualPrice: null });

    expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ plusAnnualPrice: null }),
      }),
    );
  });

  it('forwards a new offsiteAdsFeeRate into the upsert update payload', async () => {
    const prisma = makePrismaMock();
    prisma.platformSettings.upsert.mockResolvedValue({ id: 'singleton', offsiteAdsFeeRate: 0.2 });
    const service = makeService(prisma, jest.fn());

    await service.updatePlatformSettings({ offsiteAdsFeeRate: 0.2 });

    expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ offsiteAdsFeeRate: 0.2 }),
      }),
    );
  });
});
