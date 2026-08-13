import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { ShippingService } from '../shipping/shipping.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { EstimateShippingDto } from './dto/estimate-shipping.dto';
import {
  CartResponseDto,
  CartItemDto,
  ShippingEstimateDto,
} from './dto/cart-response.dto';

const MAX_ITEMS = 50;
const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          isActive: true,
          productType: true,
          storeId: true,
          shippingProfileId: true,
          images: {
            where: { type: 'MOCKUP' as const },
            orderBy: { isPrimary: 'desc' as const },
            select: { url: true },
            take: 1,
          },
        },
      },
      variant: { select: { id: true, name: true, price: true, options: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = NonNullable<
  Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>
>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly shippingService: ShippingService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async getOrCreateCart(
    userId?: string,
    sessionId?: string,
  ): Promise<{ cart: CartResponseDto; newSessionId?: string }> {
    if (userId) {
      let cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: CART_INCLUDE,
      });
      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId },
          include: CART_INCLUDE,
        });
      }
      return { cart: this.mapToDto(cart) };
    }

    if (sessionId) {
      const cart = await this.prisma.cart.findUnique({
        where: { sessionId },
        include: CART_INCLUDE,
      });
      if (cart) return { cart: this.mapToDto(cart) };
    }

    // New guest cart
    const newSessionId = randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + GUEST_CART_TTL_MS);
    const cart = await this.prisma.cart.create({
      data: { sessionId: newSessionId, expiresAt },
      include: CART_INCLUDE,
    });

    return { cart: this.mapToDto(cart), newSessionId };
  }

  async addItem(cartId: string, dto: AddCartItemDto): Promise<CartResponseDto> {
    const [product, variant] = await Promise.all([
      this.prisma.product.findFirst({
        where: { id: dto.productId, isActive: true, deletedAt: null },
        select: { id: true, basePrice: true, storeId: true },
      }),
      dto.variantId
        ? this.prisma.productVariant.findFirst({
            where: { id: dto.variantId, productId: dto.productId, isAvailable: true },
            select: { id: true, price: true },
          })
        : Promise.resolve(null),
    ]);

    if (!product)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Product not found or inactive',
      });
    if (dto.variantId && !variant)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Variant not found or no longer available',
      });

    const qty = dto.quantity ?? 1;
    // variant.price is nullable — a combination the seller hasn't priced yet
    // (or one that never varies from the base price) falls back to basePrice
    // rather than adding to the cart at $0.
    const unitPrice = variant?.price != null
      ? Number(variant.price)
      : Number(product.basePrice);
    const customKey = dto.customizationData
      ? JSON.stringify(dto.customizationData)
      : null;

    await this.prisma.$transaction(async (tx) => {
      const existingItems = await tx.cartItem.findMany({
        where: {
          cartId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
        },
      });

      const duplicate = existingItems.find(
        (item) =>
          (item.customizationData
            ? JSON.stringify(item.customizationData)
            : null) === customKey,
      );

      if (duplicate) {
        const newQty = duplicate.quantity + qty;
        if (newQty > 99) {
          throw new BadRequestException({
            code: 'ERR_QTY_EXCEEDED',
            message: 'Maximum quantity per item is 99',
          });
        }
        await tx.cartItem.update({
          where: { id: duplicate.id },
          data: { quantity: newQty },
        });
      } else {
        const currentCount = await tx.cartItem.count({ where: { cartId } });
        if (currentCount >= MAX_ITEMS) {
          throw new BadRequestException({
            code: 'ERR_CART_FULL',
            message: `Cart cannot exceed ${MAX_ITEMS} items`,
          });
        }
        await tx.cartItem.create({
          data: {
            cartId,
            productId: dto.productId,
            variantId: dto.variantId,
            quantity: qty,
            unitPrice,
            customizationData: dto.customizationData as
              | Prisma.InputJsonValue
              | undefined,
            previewUrl: dto.previewUrl,
            searchTerm: dto.searchTerm?.trim().toLowerCase() || null,
          },
        });
      }
    });

    // Reset abandonment tracking so user gets a fresh reminder if they abandon again
    await this.prisma.cart.update({
      where: { id: cartId },
      data:  { abandonedEmailSentAt: null },
    });

    if (product.storeId) {
      this.analyticsService.trackStoreMetric(product.storeId, 'addToCart').catch(() => undefined);
    }

    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
    return this.mapToDto(cart);
  }

  async updateItem(
    cartId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
    });
    if (!item)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Cart item not found',
      });

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
    return this.mapToDto(cart);
  }

  async removeItem(cartId: string, itemId: string): Promise<CartResponseDto> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
    });
    if (!item)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Cart item not found',
      });

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
    return this.mapToDto(cart);
  }

  async clearCart(cartId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId } }),
      this.prisma.cart.update({
        where: { id: cartId },
        data: { couponCode: null, discountAmount: null },
      }),
    ]);
  }

  async mergeGuestCart(
    guestSessionId: string,
    userId: string,
  ): Promise<CartResponseDto> {
    const [guestCart, userCart] = await Promise.all([
      this.prisma.cart.findUnique({
        where: { sessionId: guestSessionId },
        include: CART_INCLUDE,
      }),
      this.prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE }),
    ]);

    const targetCartId = userCart
      ? userCart.id
      : (
          await this.prisma.cart.create({
            data: { userId },
            select: { id: true },
          })
        ).id;

    if (!guestCart || guestCart.items.length === 0) {
      const result = await this.prisma.cart.findUniqueOrThrow({
        where: { id: targetCartId },
        include: CART_INCLUDE,
      });
      return this.mapToDto(result);
    }

    const targetItems = userCart?.items ?? [];

    await this.prisma.$transaction(async (tx) => {
      for (const guestItem of guestCart.items) {
        const customKey = guestItem.customizationData
          ? JSON.stringify(guestItem.customizationData)
          : null;
        const existing = targetItems.find(
          (ti) =>
            ti.productId === guestItem.productId &&
            ti.variantId === guestItem.variantId &&
            (ti.customizationData
              ? JSON.stringify(ti.customizationData)
              : null) === customKey,
        );

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: {
              quantity: Math.min(existing.quantity + guestItem.quantity, 99),
            },
          });
        } else {
          const count = await tx.cartItem.count({
            where: { cartId: targetCartId },
          });
          if (count >= MAX_ITEMS) continue;
          await tx.cartItem.create({
            data: {
              cartId: targetCartId,
              productId: guestItem.productId,
              variantId: guestItem.variantId,
              quantity: guestItem.quantity,
              unitPrice: guestItem.unitPrice,
              customizationData: guestItem.customizationData as
                | Prisma.InputJsonValue
                | undefined,
              previewUrl: guestItem.previewUrl,
            },
          });
        }
      }
      await tx.cart.delete({ where: { id: guestCart.id } });
    });

    const merged = await this.prisma.cart.findUniqueOrThrow({
      where: { id: targetCartId },
      include: CART_INCLUDE,
    });
    return this.mapToDto(merged);
  }

  async applyCoupon(
    cartId: string,
    dto: ApplyCouponDto,
    userId?: string,
  ): Promise<CartResponseDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
    if (!cart)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Cart not found',
      });

    const now = new Date();
    const promo = await this.prisma.promotion.findFirst({
      where: {
        code: dto.code,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
    });

    if (!promo)
      throw new BadRequestException({
        code: 'ERR_COUPON_INVALID',
        message: 'Invalid or expired coupon',
      });

    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      throw new BadRequestException({
        code: 'ERR_COUPON_EXHAUSTED',
        message: 'Coupon usage limit reached',
      });
    }

    const subtotal = this.calcSubtotal(cart.items);

    if (
      promo.minOrderAmount !== null &&
      subtotal < Number(promo.minOrderAmount)
    ) {
      throw new BadRequestException({
        code: 'ERR_COUPON_MIN_ORDER',
        message: `Minimum order amount of $${Number(promo.minOrderAmount).toFixed(2)} not met`,
      });
    }

    if (userId && promo.maxUsesPerUser > 0) {
      const userUsage = await this.prisma.promotionUsage.count({
        where: { promotionId: promo.id, userId },
      });
      if (userUsage >= promo.maxUsesPerUser) {
        throw new BadRequestException({
          code: 'ERR_COUPON_USER_LIMIT',
          message: 'You have already used this coupon',
        });
      }
    }

    const discountAmount = this.calcDiscount(
      promo.type,
      Number(promo.value),
      subtotal,
    );

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponCode: dto.code, discountAmount },
    });

    const updated = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
    return this.mapToDto(updated);
  }

  async removeCoupon(cartId: string): Promise<CartResponseDto> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponCode: null, discountAmount: null },
    });
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
    return this.mapToDto(cart);
  }

  async estimateShipping(
    cartId: string,
    dto: EstimateShippingDto,
  ): Promise<ShippingEstimateDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
    const unresolvable: ShippingEstimateDto = { resolvable: false, perStore: [], totalCost: 0, minDays: null, maxDays: null };
    if (!cart || cart.items.length === 0) return unresolvable;

    const physicalItems = cart.items.filter((i) => i.product.productType !== 'DIGITAL');
    if (physicalItems.length === 0) return { resolvable: true, perStore: [], totalCost: 0, minDays: null, maxDays: null };

    const result = await this.shippingService.resolveSellerShippingCost(
      physicalItems.map((i) => ({
        storeId: i.product.storeId,
        shippingProfileId: i.product.shippingProfileId,
        quantity: i.quantity,
      })),
      dto.country,
    );
    if (!result) return unresolvable;

    const perStore = [...result.perStore.entries()].map(([storeId, cost]) => {
      const days = result.deliveryDays.get(storeId)!;
      return { storeId, cost, methodName: result.methodNames.get(storeId) ?? 'Standard Shipping', minDays: days.minDays, maxDays: days.maxDays };
    });
    const totalCost = perStore.reduce((sum, s) => sum + s.cost, 0);
    const minDays = perStore.length ? Math.min(...perStore.map((s) => s.minDays)) : null;
    const maxDays = perStore.length ? Math.max(...perStore.map((s) => s.maxDays)) : null;

    return { resolvable: true, perStore, totalCost, minDays, maxDays };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private calcSubtotal(items: CartWithItems['items']): number {
    return items.reduce((sum, item) => {
      const variantPrice = item.variant?.price != null ? Number(item.variant.price) : null;
      const price = variantPrice ?? Number(item.product.basePrice);
      return sum + price * item.quantity;
    }, 0);
  }

  private calcDiscount(
    type: DiscountType,
    value: number,
    subtotal: number,
  ): number {
    if (type === DiscountType.PERCENTAGE)
      return Math.round(subtotal * value) / 100;
    if (type === DiscountType.FIXED_AMOUNT) return Math.min(subtotal, value);
    return 0; // FREE_SHIPPING applied at checkout
  }

  private mapToDto(cart: CartWithItems): CartResponseDto {
    const items: CartItemDto[] = cart.items.map((item) => {
      const variantPrice = item.variant?.price != null ? Number(item.variant.price) : null;
      const unitPrice = Number(item.unitPrice);
      const livePrice = variantPrice ?? Number(item.product.basePrice);
      // Fall back to the snapshotted unitPrice when even that live lookup is
      // legitimately 0 (variant-only product whose basePrice is $0).
      const currentPrice = livePrice > 0 ? livePrice : unitPrice;
      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        productType: item.product.productType,
        productImageUrl: item.product.images[0]?.url ?? null,
        variantId: item.variantId,
        variantName: item.variant?.name ?? null,
        variantOptions: (item.variant?.options as Record<string, string> | null) ?? null,
        quantity: item.quantity,
        unitPrice,
        currentPrice,
        priceChanged: Math.abs(currentPrice - unitPrice) >= 0.01,
        customizationData: item.customizationData as Record<
          string,
          unknown
        > | null,
        previewUrl: item.previewUrl,
      };
    });

    const subtotal = items.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
    const discount = cart.discountAmount ? Number(cart.discountAmount) : 0;
    const total = Math.max(0, subtotal - discount);

    return {
      id: cart.id,
      userId: cart.userId,
      sessionId: cart.sessionId,
      couponCode: cart.couponCode,
      discountAmount: cart.discountAmount ? Number(cart.discountAmount) : null,
      items,
      totals: {
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        shipping: 0,
        total: Math.round(total * 100) / 100,
        itemCount: items.reduce((s, i) => s + i.quantity, 0),
      },
    };
  }
}
