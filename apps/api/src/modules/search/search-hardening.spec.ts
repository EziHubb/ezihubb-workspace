import { SearchService } from './search.service';

describe('Text search filter parity', () => {
  it.each([
    { categoryId: { in: ['parent', 'child'] } },
    { collections: { some: { collectionId: 'collection' } } },
    { store: { country: 'US' }, processingDays: { lte: 3 } },
    { id: { in: ['mongo-match'] }, AND: [{ productType: 'DIGITAL' }] },
    { quantity: { gt: 0 }, primaryColors: { hasSome: ['red'] } },
  ])('keeps complete predicates in page AND count: %j', async (filter) => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn(), $transaction: (ops: Promise<unknown>[]) => Promise.all(ops) };
    const service = Object.create(SearchService.prototype) as SearchService;
    Object.assign(service, { prisma, toListItems: async () => [] });
    const baseWhere = { isActive: true, deletedAt: null, storeId: 'owned-store', ...filter };
    await service['fullTextSearch']('ornament', baseWhere as never, 2, 24);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual(baseWhere);
    expect(where.AND).toContainEqual({ isActive: true, deletedAt: null });
    expect(prisma.product.count).toHaveBeenCalledWith({ where });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 24, take: 24 }));
  });
});
