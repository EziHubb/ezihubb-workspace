import type { PrismaService } from '../../prisma/prisma.service';
import type { RedisService } from '../../common/services/redis.service';
import type { ShippingService } from '../shipping/shipping.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import { CartService } from './cart.service';

const sale = {
  id: 'sale-1',
  type: 'PERCENTAGE',
  value: 50,
  scope: 'SHOP_WIDE',
  country: null,
  products: [],
};

function cartRecord(unitPrice = 44.99) {
  return {
    id: 'cart-1',
    userId: 'buyer-1',
    sessionId: null,
    couponCode: null,
    discountAmount: null,
    items: [
      {
        id: 'cart-item-1',
        cartId: 'cart-1',
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 1,
        unitPrice,
        customizationData: null,
        previewUrl: null,
        searchTerm: null,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        product: {
          id: 'product-1',
          name: 'Sale ornament',
          slug: 'sale-ornament',
          basePrice: 29.99,
          isActive: true,
          productType: 'PHYSICAL',
          storeId: 'store-1',
          shippingProfileId: 'shipping-1',
          images: [{ url: 'https://example.com/ornament.jpg' }],
        },
        variant: {
          id: 'variant-1',
          name: '1-side Printed',
          price: 44.99,
          options: { Type: '1-side Printed' },
        },
      },
    ],
  };
}

function makePrismaMock() {
  return {
    promotion: {
      findMany: jest.fn().mockResolvedValue([sale]),
      findFirst: jest.fn(),
    },
    product: { findFirst: jest.fn() },
    productVariant: { findFirst: jest.fn() },
    platformSettings: {
      findUnique: jest.fn().mockResolvedValue({ freeShippingThreshold: 100 }),
    },
    cartItem: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    cart: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn(),
  };
}

function makeService(
  prisma: ReturnType<typeof makePrismaMock>,
  shippingService: Partial<ShippingService> = {},
) {
  return new CartService(
    prisma as unknown as PrismaService,
    {} as RedisService,
    shippingService as ShippingService,
    { trackStoreMetric: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
  );
}

describe('CartService sale pricing', () => {
  it('returns the active sale price for existing cart items and checkout totals', async () => {
    const prisma = makePrismaMock();
    prisma.cart.findUnique.mockResolvedValue(cartRecord());
    const service = makeService(prisma);

    const { cart } = await service.getOrCreateCart('buyer-1');

    expect(cart.items[0]).toEqual(expect.objectContaining({
      unitPrice: 44.99,
      currentPrice: 22.49,
      priceChanged: true,
    }));
    expect(cart.totals).toEqual({
      subtotal: 22.49,
      discount: 0,
      shipping: 0,
      total: 22.49,
      itemCount: 1,
      freeShippingThreshold: 100,
      freeShippingEligible: false,
    });
  });

  it('snapshots the discounted variant price when an item is added', async () => {
    const prisma = makePrismaMock();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-1',
      basePrice: 29.99,
      storeId: 'store-1',
    });
    prisma.productVariant.findFirst.mockResolvedValue({
      id: 'variant-1',
      price: 44.99,
    });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma as unknown as PrismaService),
    );
    prisma.cart.findUniqueOrThrow.mockResolvedValue(cartRecord(22.49));
    const service = makeService(prisma);

    const cart = await service.addItem('cart-1', {
      productId: 'product-1',
      variantId: 'variant-1',
      quantity: 1,
    });

    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ unitPrice: 22.49 }),
    });
    expect(cart.items[0]).toEqual(expect.objectContaining({
      unitPrice: 22.49,
      currentPrice: 22.49,
      priceChanged: false,
    }));
    expect(cart.totals.subtotal).toBe(22.49);
  });
});

describe('CartService platform free shipping', () => {
  const shippingResult = {
    perStore: new Map([['store-1', 5.99]]),
    deliveryDays: new Map([['store-1', { minDays: 3, maxDays: 7 }]]),
    methodNames: new Map([['store-1', 'Standard Shipping']]),
  };

  it('waives the estimate when the sale-aware merchandise total reaches the configured threshold', async () => {
    const prisma = makePrismaMock();
    const cart = cartRecord();
    const item = cart.items[0];
    if (!item) throw new Error('cart fixture must contain one item');
    item.quantity = 5;
    prisma.cart.findUnique.mockResolvedValue(cart);
    const service = makeService(prisma, {
      resolveSellerShippingCost: jest.fn().mockResolvedValue(shippingResult),
    });

    const estimate = await service.estimateShipping('cart-1', { country: 'US' });

    expect(estimate).toEqual(expect.objectContaining({
      totalCost: 0,
      freeShippingThreshold: 100,
      freeShippingApplied: true,
      platformFreeShippingApplied: true,
      shippingSubsidy: 5.99,
    }));
    expect(estimate.perStore[0].cost).toBe(0);
    expect(estimate.perStore[0].shippingSubsidy).toBe(5.99);
  });

  it('keeps the seller delivery price below the configured threshold', async () => {
    const prisma = makePrismaMock();
    prisma.cart.findUnique.mockResolvedValue(cartRecord());
    const service = makeService(prisma, {
      resolveSellerShippingCost: jest.fn().mockResolvedValue(shippingResult),
    });

    const estimate = await service.estimateShipping('cart-1', { country: 'US' });

    expect(estimate).toEqual(expect.objectContaining({
      totalCost: 5.99,
      freeShippingApplied: false,
      platformFreeShippingApplied: false,
      shippingSubsidy: 0,
    }));
  });
});
