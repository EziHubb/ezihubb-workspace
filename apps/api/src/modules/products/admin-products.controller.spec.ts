import { AdminProductsController } from './admin-products.controller';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StoreContextService, StoreContext } from '../../common/services/store-context.service';

function makePrismaMock() {
  return { product: { count: jest.fn().mockResolvedValue(0) } };
}

function makeController(prisma: ReturnType<typeof makePrismaMock>, context: StoreContext) {
  const storeContext = { resolve: jest.fn().mockResolvedValue(context) };
  const controller = new AdminProductsController(
    {} as any, // productsService — unused by getSeoStats
    prisma as unknown as PrismaService,
    {} as any, // auditLog
    storeContext as unknown as StoreContextService,
    {} as any, // titleSuggestion
  );
  return { controller, storeContext };
}

// Regression test — GET /admin/products/seo-stats had no :id param
// (ProductOwnershipGuard no-ops on routes without one) and didn't scope
// itself, so its 4 count() queries had no store filter at all: every ADMIN
// got platform-wide SEO stats, not their own store's.
describe('AdminProductsController.getSeoStats — scoping', () => {
  it('ADMIN (has a storeId): every count() query is filtered to their own store', async () => {
    const prisma = makePrismaMock();
    const { controller } = makeController(prisma, { storeId: 'store_1', isPlatformContext: false });

    await controller.getSeoStats({} as any);

    expect(prisma.product.count).toHaveBeenCalledTimes(4);
    for (const call of prisma.product.count.mock.calls) {
      expect(call[0].where.storeId).toBe('store_1');
    }
  });

  it('SUPER_ADMIN in platform context (storeId null): every count() query is unfiltered (platform-wide)', async () => {
    const prisma = makePrismaMock();
    const { controller } = makeController(prisma, { storeId: null, isPlatformContext: true });

    await controller.getSeoStats({} as any);

    expect(prisma.product.count).toHaveBeenCalledTimes(4);
    for (const call of prisma.product.count.mock.calls) {
      expect(call[0].where.storeId).toBeUndefined();
    }
  });
});
