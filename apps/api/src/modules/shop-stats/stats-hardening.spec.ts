import { ShopStatsService } from './shop-stats.service';

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
  });
});
