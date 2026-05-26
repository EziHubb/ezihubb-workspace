import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { PaymentsService } from '../payments/payments.service';

const mockShippingAddress = {
  fullName:     'Jane Doe',
  phone:        '+1-555-0100',
  addressLine1: '123 Main St',
  addressLine2: null,
  city:         'Portland',
  state:        'OR',
  postalCode:   '97201',
  country:      'US',
};

const mockProduct = {
  id:        'prod-001',
  name:      'Custom Photo Mug',
  slug:      'custom-photo-mug',
  basePrice: 29.99,
  isActive:  true,
  deletedAt: null,
};

const mockCartWithItems = {
  id:          'cart-001',
  userId:      'user-001',
  sessionId:   null,
  couponCode:  null,
  items: [
    {
      id:                'item-001',
      productId:         'prod-001',
      variantId:         null,
      quantity:          2,
      unitPrice:         29.99,
      customizationData: null,
      previewUrl:        null,
      product:           mockProduct,
      variant:           null,
    },
  ],
};

const mockOrder = {
  id:                'order-001',
  orderNumber:       'MLH-2025-00001',
  userId:            'user-001',
  guestEmail:        null,
  status:            OrderStatus.PENDING_PAYMENT,
  confirmedAt:       null,
  cancelledAt:       null,
  cancelReason:      null,
  shippedAt:         null,
  deliveredAt:       null,
  shippingName:      'Jane Doe',
  shippingPhone:     '+1-555-0100',
  shippingAddress:   '123 Main St',
  shippingCity:      'Portland',
  shippingState:     'OR',
  shippingZip:       '97201',
  shippingCountry:   'US',
  shippingMethod:    'Standard Shipping',
  shippingCost:      5.99,
  subtotal:          59.98,
  discountAmount:    0,
  total:             65.97,
  couponCode:        null,
  trackingNumber:    null,
  trackingUrl:       null,
  carrier:           null,
  note:              null,
  createdAt:         new Date('2025-01-15'),
  updatedAt:         new Date('2025-01-15'),
  items:             [],
  payment:           null,
  statusHistory:     [{ id: 'sh-001', status: OrderStatus.PENDING_PAYMENT, note: null, createdBy: null, createdAt: new Date() }],
  user:              { email: 'jane@example.com' },
};

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: DeepMockProxy<PrismaService>;
  let shippingService: jest.Mocked<ShippingService>;
  let paymentsService: jest.Mocked<PaymentsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        {
          provide: ShippingService,
          useValue: {
            calculateShipping: jest.fn().mockResolvedValue({ cost: 5.99, name: 'Standard Shipping' }),
            buildTrackingUrl:  jest.fn().mockReturnValue('https://tracking.example.com/123'),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            createPaymentIntentForOrder: jest.fn().mockResolvedValue({ clientSecret: 'pi_test_secret' }),
          },
        },
      ],
    }).compile();

    service         = module.get(OrdersService);
    prisma          = module.get(PrismaService);
    shippingService = module.get(ShippingService);
    paymentsService = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── checkout ───────────────────────────────────────────────────────────────

  describe('checkout', () => {
    const checkoutDto = {
      shippingMethodId: 'method-standard',
      shippingAddress:  mockShippingAddress,
    } as any;

    beforeEach(() => {
      prisma.cart.findFirst.mockResolvedValue(mockCartWithItems as any);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return Promise.all(fn);
      });
      prisma.$queryRaw.mockResolvedValue([{ nextval: BigInt(1) }]);
      prisma.order.create.mockResolvedValue(mockOrder as any);
      prisma.orderItem.createMany.mockResolvedValue({ count: 1 } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);
      prisma.$executeRaw.mockResolvedValue(0); // no coupon branch
    });

    it('creates order and returns orderId + clientSecret on happy path', async () => {
      const result = await service.checkout(checkoutDto, 'user-001');

      expect(result.orderNumber).toMatch(/^MLH-\d{4}-\d{5}$/);
      expect(result.clientSecret).toBe('pi_test_secret');
      expect(paymentsService.createPaymentIntentForOrder).toHaveBeenCalledWith('order-001', undefined);
    });

    it('throws ERR_CART_EMPTY when cart has no items', async () => {
      prisma.cart.findFirst.mockResolvedValue({ ...mockCartWithItems, items: [] } as any);

      await expect(service.checkout(checkoutDto, 'user-001')).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_CART_EMPTY' }) }),
      );
    });

    it('throws ERR_PRODUCT_UNAVAILABLE when a cart item references an inactive product', async () => {
      const cartWithInactiveProduct = {
        ...mockCartWithItems,
        items: [{ ...mockCartWithItems.items[0], product: { ...mockProduct, isActive: false } }],
      };
      prisma.cart.findFirst.mockResolvedValue(cartWithInactiveProduct as any);

      await expect(service.checkout(checkoutDto, 'user-001')).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_PRODUCT_UNAVAILABLE' }) }),
      );
    });

    it('throws ERR_COUPON_INVALID when coupon code does not exist or is expired', async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      await expect(
        service.checkout({ ...checkoutDto, couponCode: 'BADCODE' }, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ERR_COUPON_EXHAUSTED when coupon has hit its max usage limit', async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        code:        'FULL10',
        isActive:    true,
        type:        'PERCENTAGE',
        value:       10,
        maxUses:     100,
        currentUses: 100,
        minOrderAmount: null,
        startsAt:    null,
        expiresAt:   null,
      } as any);

      await expect(
        service.checkout({ ...checkoutDto, couponCode: 'FULL10' }, 'user-001'),
      ).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_EXHAUSTED' }) }),
      );
    });

    it('throws ERR_COUPON_RACE when atomic coupon update affects 0 rows (concurrent race)', async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        code:        'RACE10',
        isActive:    true,
        type:        'PERCENTAGE',
        value:       10,
        maxUses:     1,
        currentUses: 0,
        minOrderAmount: null,
        startsAt:    null,
        expiresAt:   null,
      } as any);
      // Atomic UPDATE returns 0 rows (another request grabbed it first)
      prisma.$executeRaw.mockResolvedValue(0);

      await expect(
        service.checkout({ ...checkoutDto, couponCode: 'RACE10' }, 'user-001'),
      ).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_COUPON_RACE' }) }),
      );
    });
  });

  // ── cancelOrder ───────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('cancels a PENDING_PAYMENT order successfully (no time restriction)', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING_PAYMENT };
      prisma.order.findFirst.mockResolvedValue(pendingOrder as any);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.order.update.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CANCELLED } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);

      const result = await service.cancelOrder('MLH-2025-00001', 'user-001', 'Changed my mind');

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('cancels a CONFIRMED order when within the 2-hour window', async () => {
      const confirmedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED, confirmedAt };
      prisma.order.findFirst.mockResolvedValue(confirmedOrder as any);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.order.update.mockResolvedValue({ ...confirmedOrder, status: OrderStatus.CANCELLED } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);

      const result = await service.cancelOrder('MLH-2025-00001', 'user-001');

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('throws ERR_ORDER_CANCEL_WINDOW_EXPIRED when CONFIRMED order is older than 2 hours', async () => {
      const confirmedAt = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED, confirmedAt };
      prisma.order.findFirst.mockResolvedValue(confirmedOrder as any);

      await expect(service.cancelOrder('MLH-2025-00001', 'user-001')).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_ORDER_CANCEL_WINDOW_EXPIRED' }) }),
      );
    });

    it('throws BadRequestException when order is already CANCELLED', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      prisma.order.findFirst.mockResolvedValue(cancelledOrder as any);

      await expect(service.cancelOrder('MLH-2025-00001', 'user-001')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when order does not belong to the user', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.cancelOrder('MLH-2025-XXXXX', 'user-001')).rejects.toThrow(NotFoundException);
    });
  });

  // ── generateOrderNumber ────────────────────────────────────────────────────

  describe('generateOrderNumber (via checkout)', () => {
    it('formats order number as MLH-YEAR-NNNNN with zero-padding', async () => {
      prisma.cart.findFirst.mockResolvedValue(mockCartWithItems as any);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return Promise.all(fn);
      });
      prisma.$queryRaw.mockResolvedValue([{ nextval: BigInt(42) }]);
      prisma.order.create.mockResolvedValue({ ...mockOrder, orderNumber: `MLH-${new Date().getFullYear()}-00042` } as any);
      prisma.orderItem.createMany.mockResolvedValue({ count: 1 } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);
      prisma.$executeRaw.mockResolvedValue(0);

      const result = await service.checkout(
        { shippingMethodId: 'method-standard', shippingAddress: mockShippingAddress } as any,
        'user-001',
      );

      expect(result.orderNumber).toMatch(/^MLH-\d{4}-00042$/);
    });

    it('produces unique numbers across sequential calls', async () => {
      prisma.cart.findFirst.mockResolvedValue(mockCartWithItems as any);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return Promise.all(fn);
      });
      prisma.orderItem.createMany.mockResolvedValue({ count: 1 } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);
      prisma.$executeRaw.mockResolvedValue(0);

      prisma.$queryRaw
        .mockResolvedValueOnce([{ nextval: BigInt(1) }])
        .mockResolvedValueOnce([{ nextval: BigInt(2) }]);

      prisma.order.create
        .mockResolvedValueOnce({ ...mockOrder, orderNumber: `MLH-${new Date().getFullYear()}-00001` } as any)
        .mockResolvedValueOnce({ ...mockOrder, id: 'order-002', orderNumber: `MLH-${new Date().getFullYear()}-00002` } as any);

      const [r1, r2] = await Promise.all([
        service.checkout({ shippingMethodId: 'method-standard', shippingAddress: mockShippingAddress } as any, 'user-001'),
        service.checkout({ shippingMethodId: 'method-standard', shippingAddress: mockShippingAddress } as any, 'user-002'),
      ]);

      expect(r1.orderNumber).not.toBe(r2.orderNumber);
    });
  });
});
