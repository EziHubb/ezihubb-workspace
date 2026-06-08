import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { ShippingService } from '../shipping/shipping.service';

const mockProductRecord = {
  id:        'prod-001',
  name:      'Custom Mug',
  slug:      'custom-mug',
  basePrice: 29.99,
  isActive:  true,
  images:    [{ url: 'https://example.com/mug.jpg' }],
};

const buildCartItem = (overrides: Record<string, unknown> = {}) => ({
  id:                'item-001',
  cartId:            'cart-001',
  productId:         'prod-001',
  variantId:         null,
  quantity:          1,
  unitPrice:         29.99,
  customizationData: null,
  previewUrl:        null,
  createdAt:         new Date(),
  product:           mockProductRecord,
  variant:           null,
  ...overrides,
});

const buildCart = (items: ReturnType<typeof buildCartItem>[] = []) => ({
  id:             'cart-001',
  userId:         'user-001',
  sessionId:      null,
  couponCode:     null,
  discountAmount: null,
  expiresAt:      null,
  createdAt:      new Date(),
  updatedAt:      new Date(),
  items,
});

describe('CartService', () => {
  let service: CartService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService,   useValue: mockDeep<PrismaService>()   },
        { provide: RedisService,    useValue: mockDeep<RedisService>()     },
        {
          provide: ShippingService,
          useValue: { getMethodsByCountry: jest.fn().mockResolvedValue([]), calculateShipping: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CartService);
    prisma  = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    const addDto = { productId: 'prod-001', quantity: 1 } as any;

    beforeEach(() => {
      prisma.product.findFirst.mockResolvedValue(mockProductRecord as any);
      prisma.productVariant.findFirst.mockResolvedValue(null);
      prisma.cartItem.findMany.mockResolvedValue([]);
      prisma.cartItem.count.mockResolvedValue(0);
      // $transaction with a callback must invoke that callback with prisma as the tx proxy
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.cart.update.mockResolvedValue({ id: 'cart-001' } as any);
    });

    it('creates a new cart item when the product is not already in the cart', async () => {
      prisma.cartItem.create.mockResolvedValue(buildCartItem() as any);
      const cart = buildCart([buildCartItem()]);
      prisma.cart.findUniqueOrThrow.mockResolvedValue(cart as any);

      const result = await service.addItem('cart-001', addDto);

      expect(prisma.cartItem.create).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(1);
    });

    it('increments quantity when same product+variant+customization is already in the cart', async () => {
      const existingItem = buildCartItem({ quantity: 2 });
      prisma.cartItem.findMany.mockResolvedValue([existingItem as any]);
      prisma.cartItem.update.mockResolvedValue(buildCartItem({ quantity: 3 }) as any);
      const cart = buildCart([buildCartItem({ quantity: 3 })]);
      prisma.cart.findUniqueOrThrow.mockResolvedValue(cart as any);

      const result = await service.addItem('cart-001', addDto);

      expect(prisma.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 3 } }),
      );
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
      expect(result.items[0].quantity).toBe(3);
    });

    it('throws ERR_CART_FULL when cart already has 50 distinct items', async () => {
      prisma.cartItem.count.mockResolvedValue(50);

      await expect(service.addItem('cart-001', addDto)).rejects.toThrow(
        expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_CART_FULL' }) }),
      );
    });

    it('throws NotFoundException when product is inactive or deleted', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.addItem('cart-001', addDto)).rejects.toThrow(NotFoundException);
    });

    it('throws ERR_QTY_EXCEEDED when incrementing an existing item would exceed 99', async () => {
      const existingItem = buildCartItem({ quantity: 99 });
      prisma.cartItem.findMany.mockResolvedValue([existingItem as any]);

      await expect(
        service.addItem('cart-001', { ...addDto, quantity: 5 }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_QTY_EXCEEDED' }),
        }),
      );

      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    });
  });

  // ── mergeGuestCart ─────────────────────────────────────────────────────────

  describe('mergeGuestCart', () => {
    it('moves all guest items into the user cart without duplicates', async () => {
      const guestCart = {
        ...buildCart([
          buildCartItem({ id: 'guest-item-1', cartId: 'guest-cart' }),
        ]),
        id:        'guest-cart',
        userId:    null,
        sessionId: 'guest-session',
      };
      const userCart = buildCart([]);

      prisma.cart.findUnique
        .mockResolvedValueOnce(guestCart as any)  // guest cart
        .mockResolvedValueOnce(userCart as any);  // user cart

      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.cartItem.count.mockResolvedValue(0);
      prisma.cartItem.create.mockResolvedValue(buildCartItem() as any);
      prisma.cart.delete.mockResolvedValue({} as any);
      prisma.cart.findUniqueOrThrow.mockResolvedValue(buildCart([buildCartItem()]) as any);

      const result = await service.mergeGuestCart('guest-session', 'user-001');

      expect(prisma.cartItem.create).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(1);
    });

    it('adds quantities when the same product already exists in the user cart', async () => {
      const sharedItem = buildCartItem({ quantity: 2 });
      const guestCart = {
        ...buildCart([buildCartItem({ id: 'guest-item-1', cartId: 'guest-cart', quantity: 3 })]),
        id:        'guest-cart',
        userId:    null,
        sessionId: 'guest-session',
      };
      const userCart = buildCart([sharedItem]);

      prisma.cart.findUnique
        .mockResolvedValueOnce(guestCart as any)
        .mockResolvedValueOnce(userCart as any);

      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.cartItem.update.mockResolvedValue(buildCartItem({ quantity: 5 }) as any);
      prisma.cart.delete.mockResolvedValue({} as any);
      prisma.cart.findUniqueOrThrow.mockResolvedValue(buildCart([buildCartItem({ quantity: 5 })]) as any);

      const result = await service.mergeGuestCart('guest-session', 'user-001');

      expect(prisma.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 5 } }),
      );
      expect(result.items[0].quantity).toBe(5);
    });

    it('returns existing user cart unchanged when guest cart is empty', async () => {
      const emptyGuestCart = {
        ...buildCart([]),
        id:        'guest-cart',
        sessionId: 'guest-session',
        userId:    null,
      };
      prisma.cart.findUnique
        .mockResolvedValueOnce(emptyGuestCart as any)
        .mockResolvedValueOnce(buildCart([buildCartItem()]) as any);

      prisma.cart.findUniqueOrThrow.mockResolvedValue(buildCart([buildCartItem()]) as any);

      const result = await service.mergeGuestCart('guest-session', 'user-001');

      expect(prisma.cartItem.create).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });
  });
});
