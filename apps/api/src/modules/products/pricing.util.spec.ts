import type { PrismaService } from '../../prisma/prisma.service';
import { withListingSales } from './pricing.util';

describe('withListingSales', () => {
  const promotion = (type: 'PERCENTAGE' | 'FIXED_AMOUNT', value: number) => ({
    id: 'promo-1',
    type,
    value,
    scope: 'SHOP_WIDE',
    country: null,
    products: [],
  });

  const prismaWith = (type: 'PERCENTAGE' | 'FIXED_AMOUNT', value: number) => ({
    promotion: {
      findMany: jest.fn().mockResolvedValue([promotion(type, value)]),
    },
  }) as unknown as PrismaService;

  it('applies a percentage sale to the lowest available variant price', async () => {
    const [item] = await withListingSales(prismaWith('PERCENTAGE', 50), [{
      id: 'product-1',
      storeId: 'store-1',
      basePrice: 29.99,
      minPrice: 12,
      maxPrice: 24,
    }]);

    expect(item.sale).toEqual({
      price: 6,
      originalPrice: 12,
      discountPercent: 50,
    });
  });

  it('also anchors fixed-amount sales to the lowest variant price', async () => {
    const [item] = await withListingSales(prismaWith('FIXED_AMOUNT', 3), [{
      id: 'product-1',
      storeId: 'store-1',
      basePrice: 29.99,
      minPrice: 12,
    }]);

    expect(item.sale).toEqual({
      price: 9,
      originalPrice: 12,
      discountPercent: 25,
    });
  });

  it('falls back to basePrice when the listing has no priced variants', async () => {
    const [item] = await withListingSales(prismaWith('PERCENTAGE', 50), [{
      id: 'product-1',
      storeId: 'store-1',
      basePrice: 29.99,
      minPrice: null,
    }]);

    expect(item.sale).toEqual({
      price: 14.99,
      originalPrice: 29.99,
      discountPercent: 50,
    });
  });
});
