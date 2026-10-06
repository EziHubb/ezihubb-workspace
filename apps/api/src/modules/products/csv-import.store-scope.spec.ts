import { CsvImportService } from './csv-import.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CSV import store ownership', () => {
  const prisma = {
    category: { findUnique: jest.fn().mockResolvedValue({ id: 'category' }) },
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    variationGroup: { create: jest.fn() },
  };
  const csv = Buffer.from(
    'name,slug,description,basePrice,status,categorySlug\nTest product,test-product,Description,15,DRAFT,gifts',
  );
  const service = new CsvImportService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('requires an explicit store', async () => {
    await expect(service.executeCsvImport(csv, '')).rejects.toThrow(
      'A store is required',
    );
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('creates in the owned store, never an orphan', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    const result = await service.executeCsvImport(csv, 'own-store');
    expect(result).toMatchObject({ imported: 1, updated: 0, failed: 0 });
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { slug: 'test-product', storeId: 'own-store', deletedAt: null },
    });
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storeId: 'own-store' }),
      }),
    );
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('updates only the product returned by the store-scoped query', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'own-product' });
    const result = await service.executeCsvImport(csv, 'own-store');
    expect(result).toMatchObject({ imported: 0, updated: 1, failed: 0 });
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { slug: 'test-product', storeId: 'own-store', deletedAt: null },
    });
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'own-product' } }),
    );
  });
});
