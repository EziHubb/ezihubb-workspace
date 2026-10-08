import 'reflect-metadata';
import { ShopStatsService } from './shop-stats.service';
import { legacyOrderWhere } from '../finances/finance-reporting-scope';
import { Request } from 'express';
import { StoreContextService } from '../../common/services/store-context.service';
import { ShopStatsController } from './shop-stats.controller';

describe('Listing revenue quantity arithmetic', () => {
  it('sums line quantity at each historical price and retains the requested shop scope', async () => {
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'p', name: 'Product', images: [], viewCount: 3 }]), count: jest.fn().mockResolvedValue(1) },
      orderItem: { groupBy: jest.fn().mockResolvedValue([
        { productId: 'p', unitPrice: '10.00', _sum: { quantity: 3 }, _count: { _all: 1 } },
        { productId: 'p', unitPrice: '12.00', _sum: { quantity: 2 }, _count: { _all: 1 } },
      ]) }, wishlistItem: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const service = Object.create(ShopStatsService.prototype) as ShopStatsService;
    Object.assign(service, { prisma });
    const result = await service.getListings(1, 24, 'recent', 'shop');
    expect(result.data[0]).toMatchObject({ revenue: 54, orders: 2 });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId: 'shop', deletedAt: null } }));
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ['productId', 'unitPrice'], _sum: { quantity: true } }));
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: {
      productId: { in: ['p'] }, storeId: 'shop',
      OR: [{ storeOrderId: null }, { storeOrder: { is: { storeId: 'shop', status: { notIn: ['CANCELLED', 'REFUNDED'] } } } }],
      order: legacyOrderWhere({ status: { notIn: ['CANCELLED', 'REFUNDED'] }, payment: { is: { status: 'PAID' } } }),
    } }));
  });
  it('retains historical unlinked lines in listing detail, but excludes cancelled shop rows and all versioned orders', async () => {
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: 'p', name: 'Product', images: [], viewCount: 3 }) },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      wishlistItem: { count: jest.fn().mockResolvedValue(0) }, review: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = Object.create(ShopStatsService.prototype) as ShopStatsService;
    Object.assign(service, { prisma });
    expect(await service.getListingStats('p', '7d')).toMatchObject({ summary: { revenue: 0 } });
    expect(prisma.orderItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      productId: 'p', OR: [{ storeOrderId: null }, { storeOrder: { is: { status: { notIn: ['CANCELLED', 'REFUNDED'] } } } }],
      order: expect.objectContaining({ AND: [{}, { economicContext: { is: null } }], payment: { is: { status: 'PAID' } } }),
    }) }));
  });
  it('filters listing-detail money by original item/shop ownership as well as current product ownership', async () => {
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: 'p', images: [] }) },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      wishlistItem: { count: jest.fn().mockResolvedValue(0) }, review: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = Object.create(ShopStatsService.prototype) as ShopStatsService;
    Object.assign(service, { prisma });
    await service.getListingStats('p', '7d', 'own');
    expect(prisma.product.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p', storeId: 'own' } }));
    expect(prisma.orderItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      productId: 'p', storeId: 'own', OR: [{ storeOrderId: null }, { storeOrder: { is: { storeId: 'own', status: { notIn: ['CANCELLED', 'REFUNDED'] } } } }],
    }) }));
  });
  it.each([
    [{ storeId: 'own', isPlatformContext: false }, 'foreign', 'own'],
    [{ storeId: 'own', isPlatformContext: false }, undefined, 'own'],
    [{ storeId: null, isPlatformContext: true }, 'target', 'target'],
    [{ storeId: null, isPlatformContext: true }, undefined, undefined],
  ])('derives detail scope from the active context, not a seller-supplied target: %s', async (context, supplied, expected) => {
    const stats = { getListingStats: jest.fn().mockResolvedValue({ summary: { revenue: 0 } }) };
    const contexts = { resolve: jest.fn().mockResolvedValue(context) };
    const controller = new ShopStatsController(stats as unknown as ShopStatsService, contexts as unknown as StoreContextService);
    const req = {} as Request;
    await controller.getListingStats(req, 'p', '7d', supplied);
    expect(contexts.resolve).toHaveBeenCalledWith(req);
    expect(stats.getListingStats).toHaveBeenCalledWith('p', '7d', expected);
  });
});
