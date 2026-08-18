import { ForbiddenException } from '@nestjs/common';
import { MarketplaceInsightsService } from './marketplace-insights.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RedisService } from '../../common/services/redis.service';
import type { SearchService } from '../search/search.service';
import type { EntitlementsService } from '../subscriptions/entitlements.service';

function makeRedisMock(usedByKey: Record<string, number>) {
  const client = {
    get: jest.fn((key: string) => Promise.resolve(String(usedByKey[key] ?? 0))),
    incr: jest.fn((key: string) => {
      usedByKey[key] = (usedByKey[key] ?? 0) + 1;
      return Promise.resolve(usedByKey[key]);
    }),
    expire: jest.fn().mockResolvedValue(1),
  };
  return {
    isAvailable: () => true,
    getClient: () => client,
  };
}

function makeService(redisMock: ReturnType<typeof makeRedisMock>, hasPlus: boolean) {
  const entitlements = { canUseFeature: jest.fn().mockResolvedValue(hasPlus) };
  return new MarketplaceInsightsService(
    {} as unknown as PrismaService,
    redisMock as unknown as RedisService,
    {} as unknown as SearchService,
    entitlements as unknown as EntitlementsService,
  );
}

describe('MarketplaceInsightsService — quota tiers', () => {
  it('free store: getQuota reports limit=20', async () => {
    const service = makeService(makeRedisMock({}), false);
    const quota = await service.getQuota('store_free');
    expect(quota.limit).toBe(20);
    expect(quota.remaining).toBe(20);
  });

  it('Plus store: getQuota reports limit=60', async () => {
    const service = makeService(makeRedisMock({}), true);
    const quota = await service.getQuota('store_plus');
    expect(quota.limit).toBe(60);
    expect(quota.remaining).toBe(60);
  });

  it('free store: the 21st lookup in a day is blocked with ERR_INSIGHTS_QUOTA_EXCEEDED', async () => {
    const used: Record<string, number> = {};
    const service = makeService(makeRedisMock(used), false);
    const consumeQuota = (service as any).consumeQuota.bind(service);

    for (let i = 0; i < 20; i++) await consumeQuota('store_free'); // 20 allowed
    await expect(consumeQuota('store_free')).rejects.toThrow(ForbiddenException); // 21st blocked
    await expect(consumeQuota('store_free')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ERR_INSIGHTS_QUOTA_EXCEEDED' }),
    });
  });

  it('Plus store: the 61st lookup in a day is blocked, but the 60th is allowed', async () => {
    const used: Record<string, number> = {};
    const service = makeService(makeRedisMock(used), true);
    const consumeQuota = (service as any).consumeQuota.bind(service);

    for (let i = 0; i < 60; i++) await expect(consumeQuota('store_plus')).resolves.toBeUndefined();
    await expect(consumeQuota('store_plus')).rejects.toThrow(ForbiddenException);
  });

  it('Plus expires mid-day after 45 lookups already used: the 46th is blocked immediately against the free limit — no special reset logic needed, the limit is re-resolved live on every call', async () => {
    const todayKey = 'marketplace-insights:quota:store_x:' + new Date().toISOString().slice(0, 10);
    const used: Record<string, number> = { [todayKey]: 45 };
    const redisMock = makeRedisMock(used);
    const entitlements = { canUseFeature: jest.fn().mockResolvedValue(true) }; // starts as Plus
    const service = new MarketplaceInsightsService(
      {} as unknown as PrismaService,
      redisMock as unknown as RedisService,
      {} as unknown as SearchService,
      entitlements as unknown as EntitlementsService,
    );
    const consumeQuota = (service as any).consumeQuota.bind(service);

    // Still Plus (limit 60), used=45 -> allowed, used becomes 46
    await expect(consumeQuota('store_x')).resolves.toBeUndefined();

    // Plus lapses mid-day -> canUseFeature now returns false -> limit drops to 20
    entitlements.canUseFeature.mockResolvedValue(false);
    // used is now 46, which already exceeds the free limit of 20 -> blocked immediately
    await expect(consumeQuota('store_x')).rejects.toThrow(ForbiddenException);
  });
});
