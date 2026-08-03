import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { TrackingService } from '../shipping/tracking.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TaxService } from '../tax/tax.service';
import { AffiliateTrackingService } from '../affiliates/affiliate-tracking.service';
import { fmtDateTimeVN } from '../../common/utils/date';
import { CommissionService } from '../affiliates/commission.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PushService } from '../notifications/push.service';
import { ReferralService } from '../referrals/referral.service';
import { StoreCreditsService } from '../store-credits/store-credits.service';
import { CoinService } from '../coins/coin.service';
import { CheckoutDto, CheckoutResponseDto } from './dto/checkout.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AddTrackingDto } from './dto/add-tracking.dto';
import { MarkShippedDto } from './dto/mark-shipped.dto';
import {
  OrderResponseDto,
  OrderItemDto,
  OrderPaymentDto,
  OrderStatusHistoryDto,
  OrderCustomerDto,
} from './dto/order-response.dto';
import {
  OrderListItemDto,
  AdminOrderQueryDto,
} from './dto/order-list-item.dto';
import {
  PaginatedResult,
  paginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

const CART_INCLUDE_FOR_CHECKOUT = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          basePrice: true,
          isActive: true,
          deletedAt: true,
          storeId: true,
          images: {
            orderBy: { isPrimary: 'desc' as const },
            select: { url: true },
            take: 1,
          },
        },
      },
      variant: {
        select: { id: true, name: true, price: true, sku: true, options: true },
      },
    },
  },
} satisfies Prisma.CartInclude;

const ORDER_INCLUDE = {
  items: true,
  payment: true,
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.OrderInclude;

const CANCEL_WINDOW_MS   = 2 * 60 * 60 * 1_000; // 2 hours
const GIFT_WRAPPING_PRICE = 4.99;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shippingService: ShippingService,
    private readonly trackingService: TrackingService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
    private readonly taxService: TaxService,
    private readonly affiliateTrackingService: AffiliateTrackingService,
    private readonly commissionService: CommissionService,
    private readonly loyaltyService: LoyaltyService,
    private readonly pushService: PushService,
    private readonly referralService: ReferralService,
    @Optional() private readonly storeCreditsService?: StoreCreditsService,
    @Optional() private readonly coinService?: CoinService,
  ) {}

  // ─── Checkout ─────────────────────────────────────────────────────────────

  async checkout(
    dto: CheckoutDto,
    userId?: string,
    sessionId?: string,
    cookies?: Record<string, string>,
  ): Promise<CheckoutResponseDto> {
    if (!userId && !dto.guestEmail) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'guestEmail is required for guest checkout',
      });
    }

    // Fetch cart
    if (!userId && !sessionId) {
      throw new BadRequestException({
        code: 'ERR_CART_NOT_FOUND',
        message: 'No cart session found',
      });
    }
    const cartWhere: Prisma.CartWhereInput = userId
      ? { userId }
      : { sessionId };
    const cart = await this.prisma.cart.findFirst({
      where: cartWhere,
      include: CART_INCLUDE_FOR_CHECKOUT,
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException({
        code: 'ERR_CART_EMPTY',
        message: 'Cart is empty',
      });
    }

    // Re-validate all items
    for (const item of cart.items) {
      if (!item.product.isActive || item.product.deletedAt) {
        throw new BadRequestException({
          code: 'ERR_PRODUCT_UNAVAILABLE',
          message: `Product "${item.product.name}" is no longer available`,
        });
      }
    }

    // Recalculate subtotal from current prices (server-side, never trust client)
    const subtotal = cart.items.reduce((sum, item) => {
      const variantPrice = item.variant ? Number(item.variant.price) : 0;
      const price = variantPrice > 0 ? variantPrice : Number(item.product.basePrice);
      return sum + price * item.quantity;
    }, 0);

    // Validate coupon and calculate discount
    let discount = 0;
    let freeShipping = false;
    let couponCode: string | undefined = cart.couponCode ?? undefined;
    if (dto.couponCode) couponCode = dto.couponCode;

    if (couponCode) {
      const now = new Date();
      const promo = await this.prisma.promotion.findFirst({
        where: {
          code: couponCode,
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        },
      });

      if (!promo) {
        throw new BadRequestException({
          code: 'ERR_COUPON_INVALID',
          message: 'Coupon is invalid or expired',
        });
      }
      if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
        throw new BadRequestException({
          code: 'ERR_COUPON_EXHAUSTED',
          message: 'Coupon usage limit reached',
        });
      }
      if (
        promo.minOrderAmount !== null &&
        subtotal < Number(promo.minOrderAmount)
      ) {
        throw new BadRequestException({
          code: 'ERR_COUPON_MIN_ORDER',
          message: 'Order does not meet coupon minimum',
        });
      }

      if (promo.type === 'PERCENTAGE')
        discount = Math.round(subtotal * Number(promo.value)) / 100;
      else if (promo.type === 'FIXED_AMOUNT')
        discount = Math.min(subtotal, Number(promo.value));
      else if (promo.type === 'FREE_SHIPPING') freeShipping = true;
    }

    const subtotalAfterDiscount = Math.max(0, subtotal - discount);

    // ── Affiliate attribution ────────────────────────────────────────────────
    let affiliateId: string | null = null;
    let affiliateDiscountAmount    = 0;
    const referralCode = cookies?.['ezihubb_affiliate'];
    const visitorId    = cookies?.['ezihubb_visitor'];

    if (referralCode) {
      const resolved = await this.affiliateTrackingService.resolveAffiliate(referralCode);
      if (resolved) {
        affiliateId             = resolved.affiliateId;
        // Discount applied to pre-coupon subtotal; stacks with coupon
        affiliateDiscountAmount = Math.round(subtotal * resolved.discountRate * 100) / 100;
      }
    }

    // ── Referral attribution (multi-level) ──────────────────────────────────
    let referralUserId: string | null = null;
    let referralDiscountAmt = 0;
    const mlhRef = cookies?.['ezihubb_ref'];

    if (mlhRef && userId) {
      const resolved = await this.referralService.resolveCode(mlhRef);
      if (resolved) {
        // Find the user who owns this referral code (must not be the buyer)
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode: mlhRef.toUpperCase() },
          select: { id: true },
        });
        if (referrer && referrer.id !== userId) {
          referralUserId    = referrer.id;
          referralDiscountAmt = Math.round(subtotal * resolved.discountRate * 100) / 100;
        }
      }
    }

    // ── Buyer referral token ─────────────────────────────────────────────────
    const buyerRefToken = dto.buyerRefToken ?? cookies?.['mlh_buyer_ref'] ?? null;

    // ── Loyalty points redemption ────────────────────────────────────────────
    let pointsDiscount  = 0;
    let pointsToRedeem  = 0;

    if (userId && dto.pointsToRedeem && dto.pointsToRedeem >= 100) {
      // Pre-validate before computing total (total not yet known, use subtotal as proxy)
      // Full validation runs inside the transaction against the real total
      const validation = await this.loyaltyService.validateRedemption(
        userId,
        dto.pointsToRedeem,
        subtotalAfterDiscount, // conservative — real total (with shipping) is higher
      );
      pointsToRedeem = dto.pointsToRedeem;
      pointsDiscount = validation.pointsDiscount;
    }

    // ── Store credit pre-calculation ─────────────────────────────────────────
    // Determine the primary store for this order (first store in cart)
    const primaryStoreId = cart.items.find(i => i.product.storeId)?.product.storeId ?? null;

    let storeCreditUsed = new Prisma.Decimal(0);
    if (dto.useStoreCredit && userId && primaryStoreId) {
      const available = await this.storeCreditsService?.getUserStoreCredits(userId);
      const availableForStore = available?.credits
        .filter((c: { storeId: string; amount: { toString(): string } }) => c.storeId === primaryStoreId)
        .reduce(
          (s: Prisma.Decimal, c: { amount: { toString(): string } }) => s.plus(new Prisma.Decimal(c.amount.toString())),
          new Prisma.Decimal(0),
        ) ?? new Prisma.Decimal(0);
      const subtotalDecimal = new Prisma.Decimal(subtotalAfterDiscount);
      storeCreditUsed = availableForStore.gt(subtotalDecimal) ? subtotalDecimal : availableForStore;
    }

    // Calculate shipping (waived if FREE_SHIPPING coupon applied)
    const shippingCalc = await this.shippingService.calculateShipping(
      dto.shippingMethodId,
      subtotalAfterDiscount,
    );
    const shippingCost = freeShipping ? 0 : shippingCalc.cost;
    const shippingMethodName = shippingCalc.name;

    const giftWrappingCost = dto.giftWrapping ? GIFT_WRAPPING_PRICE : 0;

    // ── Tax calculation (US only, never blocks checkout) ──────────────────────
    const { shippingAddress: addr } = dto;
    const taxResult = await this.taxService.calculateTax({
      toZip:     addr.postalCode,
      toState:   addr.state ?? '',
      toCountry: addr.country,
      subtotal:  subtotalAfterDiscount + giftWrappingCost,
      shipping:  shippingCost,
      lineItems: cart.items.map((item) => {
        const vp = item.variant ? Number(item.variant.price) : 0;
        return {
          id:        item.productId,
          quantity:  item.quantity,
          unitPrice: vp > 0 ? vp : Number(item.product.basePrice),
        };
      }),
    });
    // Affiliate + referral + loyalty + store-credit discounts — applied AFTER coupon, BEFORE payment
    const total = Math.max(
      0,
      Math.round(
        (subtotalAfterDiscount + shippingCost + taxResult.taxAmount + giftWrappingCost - affiliateDiscountAmount - referralDiscountAmt - pointsDiscount - storeCreditUsed.toNumber()) * 100,
      ) / 100,
    );

    // $transaction: create order + items + status history + atomic coupon increment
    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber(tx);

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: userId ?? null,
          guestEmail: dto.guestEmail ?? null,
          status: OrderStatus.PENDING_PAYMENT,
          shippingName: addr.fullName,
          shippingPhone: addr.phone,
          shippingAddress: [addr.addressLine1, addr.addressLine2]
            .filter(Boolean)
            .join(', '),
          shippingCity: addr.city,
          shippingState: addr.state ?? null,
          shippingZip: addr.postalCode,
          shippingCountry: addr.country,
          shippingMethod: shippingMethodName,
          shippingCost,
          subtotal:       Math.round(subtotal * 100) / 100,
          discountAmount: Math.round(discount * 100) / 100,
          taxAmount:      taxResult.taxAmount,
          taxRate:        taxResult.taxRate,
          taxJurisdiction: taxResult.jurisdiction ?? null,
          total,
          couponCode:     couponCode ?? null,
          isGift:         dto.isGift ?? false,
          giftMessage:    dto.isGift ? (dto.giftMessage ?? null) : null,
          giftFrom:       dto.isGift ? (dto.giftFrom ?? null) : null,
          giftReceipt:    dto.isGift ? (dto.giftReceipt ?? false) : false,
          giftWrapping:            dto.giftWrapping ?? false,
          note:                    dto.note ?? null,
          affiliateId:              affiliateId,
          affiliateDiscountAmount:  affiliateDiscountAmount > 0 ? affiliateDiscountAmount : undefined,
          referralUserId:           referralUserId ?? undefined,
          referralDiscountAmount:   referralDiscountAmt > 0 ? referralDiscountAmt : undefined,
          pointsRedeemed:          pointsToRedeem > 0 ? pointsToRedeem : undefined,
          pointsDiscount:          pointsDiscount > 0 ? pointsDiscount : undefined,
          storeCreditUsed:         new Prisma.Decimal(0), // updated after credit is consumed below
          buyerRefToken:           buyerRefToken ?? null,
        },
      });

      // Snapshot current prices and product data into order items
      await tx.orderItem.createMany({
        data: cart.items.map((item) => ({
          orderId:          newOrder.id,
          productId:        item.productId,
          variantId:        item.variantId,
          quantity:         item.quantity,
          unitPrice:        (() => {
            const vp = item.variant ? Number(item.variant.price) : 0;
            return vp > 0 ? vp : Number(item.product.basePrice);
          })(),
          customizationData: item.customizationData as
            | Prisma.InputJsonValue
            | undefined,
          previewUrl:       item.previewUrl,
          storeId:          item.product.storeId ?? null,
          // ── Snapshots captured at order time ─────────────────────────────
          productName:      item.product.name,
          productSlug:      item.product.slug,
          productImageUrl:  item.product.images?.[0]?.url ?? null,
          variantName:      item.variant?.name ?? null,
          variantSnapshot:  item.variant?.options as Prisma.InputJsonValue ?? null,
          sku:              item.variant?.sku ?? item.product.sku ?? null,
        })),
      });

      // ── Split into StoreOrders (1 per store) ──────────────────────────────
      const storeGroups = new Map<string, typeof cart.items>();
      for (const item of cart.items) {
        const sid = item.product.storeId;
        if (!sid) continue;
        if (!storeGroups.has(sid)) storeGroups.set(sid, []);
        storeGroups.get(sid)!.push(item);
      }

      if (storeGroups.size > 0) {
        const platformSettings = await tx.platformSettings.findUnique({ where: { id: 'singleton' } });
        const defaultRate = Number(platformSettings?.defaultCommissionRate ?? 0.15);

        const storeRecords = await tx.store.findMany({
          where:  { id: { in: [...storeGroups.keys()] } },
          select: { id: true, commissionRate: true },
        });
        const storeRateMap = new Map(storeRecords.map(s => [s.id, s.commissionRate]));

        for (const [storeId, items] of storeGroups) {
          const storeSubtotal = items.reduce((sum, item) => {
            const vp = item.variant ? Number(item.variant.price) : 0;
            const price = vp > 0 ? vp : Number(item.product.basePrice);
            return sum + price * item.quantity;
          }, 0);

          const rateRaw      = storeRateMap.get(storeId);
          const feeRate      = rateRaw != null ? Number(rateRaw) : defaultRate;
          const platformFee  = Math.round(storeSubtotal * feeRate * 100) / 100;
          const sellerEarnings = Math.round((storeSubtotal - platformFee) * 100) / 100;

          const storeOrder = await tx.storeOrder.create({
            data: {
              orderId:        newOrder.id,
              storeId,
              status:         OrderStatus.PENDING_PAYMENT,
              subtotal:       Math.round(storeSubtotal * 100) / 100,
              platformFee,
              sellerEarnings,
              shippingCost:   0,
            },
          });

          await tx.orderItem.updateMany({
            where: {
              orderId:   newOrder.id,
              productId: { in: items.map(i => i.productId) },
            },
            data: { storeOrderId: storeOrder.id },
          });
        }
      }

      // Initial status history entry
      await tx.orderStatusHistory.create({
        data: { orderId: newOrder.id, status: OrderStatus.PENDING_PAYMENT },
      });

      // Atomic coupon increment — race-safe via conditional UPDATE
      if (couponCode) {
        const affected = await tx.$executeRaw`
          UPDATE "Promotion"
          SET "currentUses" = "currentUses" + 1
          WHERE code = ${couponCode}
            AND "isActive" = true
            AND ("maxUses" IS NULL OR "currentUses" < "maxUses")
        `;
        if (affected === 0) {
          throw new BadRequestException({
            code: 'ERR_COUPON_RACE',
            message: 'Coupon is no longer available',
          });
        }
      }

      // Record promotion usage
      if (couponCode && userId) {
        const promo = await tx.promotion.findUnique({
          where: { code: couponCode },
          select: { id: true },
        });
        if (promo) {
          await tx.promotionUsage.create({
            data: { promotionId: promo.id, userId, orderId: newOrder.id },
          });
        }
      }

      // Deduct loyalty points inside transaction (atomic: if order fails, points are not deducted)
      if (userId && pointsToRedeem > 0) {
        await this.loyaltyService.redeemPoints(userId, newOrder.id, pointsToRedeem, tx);
      }

      // Consume store credit inside transaction (atomic with order creation)
      if (storeCreditUsed.gt(0) && userId && primaryStoreId) {
        await this.storeCreditsService?.consumeStoreCredit(
          tx, userId, primaryStoreId, storeCreditUsed, newOrder.id,
        );
        await tx.order.update({
          where: { id: newOrder.id },
          data:  { storeCreditUsed },
        });
      }

      return newOrder;
    });

    // Mark affiliate click as converted now that we have the orderId
    if (affiliateId && visitorId) {
      this.affiliateTrackingService
        .markClickConverted(visitorId, affiliateId, order.id)
        .catch(() => {}); // non-critical; never blocks checkout
    }

    // OUTSIDE transaction: create Stripe PaymentIntent
    const paymentResponse =
      await this.paymentsService.createPaymentIntentForOrder(
        order.id,
        dto.giftCardCode,
      );

    return {
      orderId:      order.id,
      orderNumber:  order.orderNumber,
      clientSecret: paymentResponse.clientSecret,
      total,
      taxAmount:    taxResult.taxAmount,
    };
  }

  // ─── Customer Queries ─────────────────────────────────────────────────────

  async findMyOrders(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<OrderListItemDto>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          items: {
            select: {
              quantity: true,
              previewUrl: true,
              productImageUrl: true,
            },
            take: 1,
            orderBy: { previewUrl: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    const data: OrderListItemDto[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total),
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      previewUrl: o.items[0]?.previewUrl ?? null,
      imageUrl: o.items[0]?.previewUrl ?? o.items[0]?.productImageUrl ?? null,
      createdAt: o.createdAt,
    }));

    return paginatedResponse(data, page, limit, total);
  }

  async findMyOrderByNumber(
    userId: string,
    orderNumber: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: ORDER_INCLUDE,
    });
    if (!order)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Order not found',
      });
    return this.mapToDto(order);
  }

  async findGuestOrder(
    orderNumber: string,
    email: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, guestEmail: email.toLowerCase() },
      include: ORDER_INCLUDE,
    });
    if (!order)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Order not found',
      });
    return this.mapToDto(order);
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────

  async cancelOrder(
    orderNumber: string,
    userId?: string,
    reason?: string,
    guestEmail?: string,
  ): Promise<OrderResponseDto> {
    const where: Prisma.OrderWhereInput = { orderNumber };
    if (userId) where.userId = userId;
    else if (guestEmail) where.guestEmail = guestEmail.toLowerCase();
    else
      throw new BadRequestException({
        code: 'ERR_UNAUTHORIZED',
        message: 'Authentication required to cancel order',
      });

    const order = await this.prisma.order.findFirst({
      where,
      include: ORDER_INCLUDE,
    });
    if (!order)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Order not found',
      });

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'ERR_ORDER_ALREADY_CANCELLED',
        message: 'Order is already cancelled',
      });
    }

    if (order.status === OrderStatus.CONFIRMED) {
      const cancelDeadline = new Date(
        (order.confirmedAt?.getTime() ?? 0) + CANCEL_WINDOW_MS,
      );
      if (new Date() > cancelDeadline) {
        throw new BadRequestException({
          code: 'ERR_ORDER_CANCEL_WINDOW_EXPIRED',
          message: 'Order can only be cancelled within 2 hours of confirmation',
        });
      }
    } else if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException({
        code: 'ERR_ORDER_CANCEL_NOT_ALLOWED',
        message: `Order in status ${order.status} cannot be cancelled`,
      });
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason ?? null,
          cancelledAt: now,
        },
        include: ORDER_INCLUDE,
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.CANCELLED,
          note: reason ?? 'Cancelled by customer',
        },
      });
      return o;
    });

    return this.mapToDto(updated);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async findAll(
    query: AdminOrderQueryDto,
  ): Promise<PaginatedResult<OrderListItemDto> & { statusCounts: Record<string, number> }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const { status, search, startDate, endDate, storeId } = query;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (storeId) where.storeOrders = { some: { storeId } };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { guestEmail: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate);
      if (endDate)
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate);
    }

    const [orders, total, statusGroups] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          shippingName: true,
          shippingCity: true,
          shippingCountry: true,
          shippingMethod: true,
          shippingCost: true,
          createdAt: true,
          items: {
            select: {
              quantity: true,
              previewUrl: true,
              productImageUrl: true,
            },
            orderBy: { previewUrl: 'desc' },
            take: 1,
          },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          storeOrders: {
            select: { store: { select: { name: true, slug: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true }, where }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const g of statusGroups) {
      statusCounts[g.status] = g._count._all;
    }

    const data: OrderListItemDto[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total),
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      previewUrl: o.items[0]?.previewUrl ?? null,
      imageUrl: o.items[0]?.previewUrl ?? o.items[0]?.productImageUrl ?? null,
      shippingName: o.shippingName,
      shippingCity: o.shippingCity,
      shippingCountry: o.shippingCountry,
      shippingMethod: o.shippingMethod,
      shippingCost: Number(o.shippingCost),
      createdAt: o.createdAt,
      customer: o.user
        ? { id: o.user.id, firstName: o.user.firstName, lastName: o.user.lastName, email: o.user.email }
        : null,
      stores: o.storeOrders.map((so) => ({ name: so.store.name, slug: so.store.slug })),
    }));

    return { ...paginatedResponse(data, page, limit, total), statusCounts };
  }

  async findById(id: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Order not found',
      });
    return this.mapToDto(order);
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    adminId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Order not found',
      });

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === OrderStatus.SHIPPED
            ? { shippedAt: new Date() }
            : {}),
          ...(dto.status === OrderStatus.DELIVERED
            ? { deliveredAt: new Date() }
            : {}),
        },
        include: ORDER_INCLUDE,
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: dto.status,
          note: dto.note ?? null,
          createdBy: adminId,
        },
      });
      return o;
    });

    if (dto.status === OrderStatus.CONFIRMED) {
      // Create buyer referral record for the orderer (so their link can be shared)
      this.storeCreditsService?.createBuyerReferralForOrder(id).catch((e) =>
        this.logger.error('createBuyerReferralForOrder failed', e),
      );
      // Process incoming buyer referral: credit the person who shared their link
      const orderWithRef = await this.prisma.order.findUnique({
        where: { id },
        select: { buyerRefToken: true },
      });
      if (orderWithRef?.buyerRefToken) {
        this.storeCreditsService?.processBuyerReferral(id, orderWithRef.buyerRefToken).catch((e) =>
          this.logger.error('processBuyerReferral failed', e),
        );
      }
    }

    if (dto.status === OrderStatus.DELIVERED) {
      // Affiliate commission lock period
      if (order.affiliateId) {
        this.commissionService
          .scheduleAutoConfirm(id)
          .catch((err: Error) =>
            this.logger.error(`Failed to schedule auto-confirm for order ${id}: ${err.message}`),
          );
      }
      // Referral commission lock period
      if (order.referralUserId) {
        this.referralService
          .scheduleAutoConfirm(id)
          .catch((err: Error) =>
            this.logger.error(`Failed to schedule referral auto-confirm for order ${id}: ${err.message}`),
          );
      }
      // Loyalty points lock period (14d after delivery → pending → balance)
      if (order.userId) {
        this.loyaltyService
          .schedulePointsConfirm(id, order.userId)
          .catch((err: Error) =>
            this.logger.error(`Failed to schedule loyalty confirm for order ${id}: ${err.message}`),
          );
      }
      // BuyCoins: earn coins immediately on delivery
      if (order.userId && this.coinService) {
        this.coinService
          .earnCoins(order.userId, id, Number(order.total))
          .catch((err: Error) =>
            this.logger.error(`Failed to earn coins for order ${id}: ${err.message}`),
          );
      }
    }

    return this.mapToDto(updated);
  }

  async addTracking(
    id: string,
    dto: AddTrackingDto,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Order not found',
      });

    const trackingUrl =
      dto.trackingUrl ??
      this.shippingService.buildTrackingUrl(dto.carrier, dto.trackingNumber);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        carrier: dto.carrier,
        trackingNumber: dto.trackingNumber,
        trackingUrl,
      },
      include: ORDER_INCLUDE,
    });

    return this.mapToDto(updated);
  }

  async previewTax(dto: {
    postalCode:   string;
    state?:       string;
    country:      string;
    subtotal:     number;
    shippingCost: number;
  }) {
    return this.taxService.calculateTax({
      toZip:     dto.postalCode,
      toState:   dto.state ?? '',
      toCountry: dto.country,
      subtotal:  dto.subtotal,
      shipping:  dto.shippingCost,
    });
  }

  async markShipped(
    id: string,
    dto: MarkShippedDto,
    adminId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order)
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });

    const unshippableStatuses: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
    ];
    if (unshippableStatuses.includes(order.status)) {
      throw new BadRequestException({
        code: 'ERR_ORDER_CANNOT_SHIP',
        message: `Order in status ${order.status} cannot be marked as shipped`,
      });
    }

    const carrier = dto.carrier ?? this.trackingService.detectCarrier(dto.trackingNumber);
    const trackingUrl =
      dto.trackingUrl ?? this.trackingService.buildTrackingUrl(carrier, dto.trackingNumber);

    // Register EasyPost tracker — non-blocking; null if unconfigured
    const trackerId = await this.trackingService.registerTracker(dto.trackingNumber, carrier);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: {
          status:         OrderStatus.SHIPPED,
          carrier,
          trackingNumber: dto.trackingNumber,
          trackingUrl,
          ...(trackerId && { trackerId }),
          shippedAt:      now,
        },
        include: ORDER_INCLUDE,
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId:   id,
          status:    OrderStatus.SHIPPED,
          note:      dto.note ?? null,
          createdBy: adminId,
        },
      });
      return o;
    });

    const email = order.guestEmail ?? order.user?.email;
    if (email) {
      await this.notificationsService.sendOrderShipped({
        email,
        orderNumber:    order.orderNumber,
        firstName:      order.user?.firstName ?? undefined,
        trackingNumber: dto.trackingNumber,
        carrier,
        trackingUrl,
      });
    }

    // Push notification (fire-and-forget)
    if (order.userId) {
      this.pushService
        .notifyOrderShipped(order.userId, order.orderNumber, carrier)
        .catch((err: Error) =>
          this.logger.warn(`Push notify failed for order ${id}: ${err.message}`),
        );
    }

    return this.mapToDto(updated);
  }

  async exportOrdersCsv(query: AdminOrderQueryDto): Promise<string> {
    const { status, search, startDate, endDate, storeId } = query;
    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (storeId) where.storeOrders = { some: { storeId } };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { guestEmail: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate);
      if (endDate)
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate);
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        orderNumber: true,
        status: true,
        guestEmail: true,
        total: true,
        shippingCost: true,
        discountAmount: true,
        couponCode: true,
        trackingNumber: true,
        carrier: true,
        createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });

    const header = [
      'Order Number',
      'Status',
      'Email',
      'Subtotal',
      'Discount',
      'Shipping',
      'Total',
      'Coupon',
      'Carrier',
      'Tracking Number',
      'Created At',
    ].join(',');

    const rows = orders.map((o) =>
      [
        o.orderNumber,
        o.status,
        o.guestEmail ?? o.user?.email ?? '',
        (
          Number(o.total) -
          Number(o.shippingCost) +
          Number(o.discountAmount)
        ).toFixed(2),
        Number(o.discountAmount).toFixed(2),
        Number(o.shippingCost).toFixed(2),
        Number(o.total).toFixed(2),
        o.couponCode ?? '',
        o.carrier ?? '',
        o.trackingNumber ?? '',
        fmtDateTimeVN(o.createdAt),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    return [header, ...rows].join('\n');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async generateOrderNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const [{ nextval }] = await tx.$queryRaw<
      [{ nextval: bigint }]
    >`SELECT NEXTVAL('order_number_seq')`;
    const year = new Date().getFullYear();
    return `MLH-${year}-${Number(nextval).toString().padStart(5, '0')}`;
  }

  // ─── Admin helpers ───────────────────────────────────────────────────────

  async addAdminNote(id: string, note: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });
    await this.prisma.order.update({ where: { id }, data: { privateNote: note } });
  }

  async adminCancelOrder(id: string, reason: string, adminId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({ code: 'ERR_ORDER_ALREADY_CANCELLED', message: 'Order is already cancelled' });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED, cancelReason: reason ?? null, cancelledAt: new Date() },
        include: ORDER_INCLUDE,
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: OrderStatus.CANCELLED, note: reason ?? 'Cancelled by admin', createdBy: adminId },
      });
      return o;
    });
    return this.mapToDto(updated);
  }

  async getEarnings(id: string): Promise<Record<string, unknown>> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });

    const subtotal         = Number(order.subtotal);
    const shippingCost     = Number(order.shippingCost);
    const discountAmount   = Number(order.discountAmount);
    const taxAmount        = Number(order.taxAmount);
    const affiliateDisc    = Number(order.affiliateDiscountAmount ?? 0);
    const referralDisc     = Number(order.referralDiscountAmount ?? 0);
    const pointsDisc       = Number(order.pointsDiscount ?? 0);
    const total            = Number(order.total);

    // Platform fees (5% transaction + 3%+$0.25 payment processing)
    const transactionFee   = Math.round(total * 0.05 * 100) / 100;
    const processingFee    = Math.round((total * 0.03 + 0.25) * 100) / 100;
    const netEarnings      = Math.round((total - transactionFee - processingFee) * 100) / 100;

    return {
      buyerPaid:         total,
      itemRevenue:       subtotal,
      shippingRevenue:   shippingCost,
      couponDiscount:    discountAmount,
      affiliateDiscount: affiliateDisc,
      referralDiscount:  referralDisc,
      pointsDiscount:    pointsDisc,
      taxAmount,
      transactionFee,
      processingFee,
      netEarnings,
    };
  }

  private mapToDto(
    order: Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>,
  ): OrderResponseDto {
    const items: OrderItemDto[] = order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      productSlug: i.productSlug,
      variantName: i.variantName,
      variantSnapshot: i.variantSnapshot as Record<string, string> | null,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.unitPrice) * i.quantity,
      customizationData: i.customizationData as Record<string, unknown> | null,
      previewUrl: i.previewUrl,
      imageUrl: i.productImageUrl,
      product: {
        name: i.productName,
        slug: i.productSlug,
        imageUrl: i.productImageUrl ?? undefined,
      },
    }));

    const payment: OrderPaymentDto | null = order.payment
      ? {
          id: order.payment.id,
          method: order.payment.method,
          status: order.payment.status,
          amount: Number(order.payment.amount),
          currency: order.payment.currency,
          stripePaymentIntentId: order.payment.stripePaymentIntentId,
          giftCardCode: order.payment.giftCardCode,
          giftCardAmount: order.payment.giftCardAmount
            ? Number(order.payment.giftCardAmount)
            : null,
          refundedAmount: Number(order.payment.refundedAmount),
          paidAt: order.payment.paidAt,
        }
      : null;

    const statusHistory: OrderStatusHistoryDto[] = order.statusHistory.map(
      (h) => ({
        id: h.id,
        status: h.status,
        note: h.note,
        createdBy: h.createdBy,
        createdAt: h.createdAt,
      }),
    );

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      guestEmail: order.guestEmail,
      status: order.status,
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingAddress: {
        addressLine1: order.shippingAddress,
        city:         order.shippingCity,
        state:        order.shippingState ?? undefined,
        postalCode:   order.shippingZip,
        country:      order.shippingCountry,
        phone:        order.shippingPhone || undefined,
      } as any,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingZip: order.shippingZip,
      shippingCountry: order.shippingCountry,
      shippingMethod: order.shippingMethod,
      shippingCost: Number(order.shippingCost),
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      couponCode: order.couponCode,
      trackingNumber: order.trackingNumber,
      trackingUrl:    order.trackingUrl,
      carrier:        order.carrier,
      trackerId:      order.trackerId,
      taxAmount:      Number(order.taxAmount),
      taxRate:        Number(order.taxRate),
      taxJurisdiction: order.taxJurisdiction,
      taxExempt:      order.taxExempt,
      isGift:         order.isGift,
      giftMessage:    order.giftMessage,
      giftFrom:       order.giftFrom,
      giftReceipt:    order.giftReceipt,
      giftWrapping:   order.giftWrapping,
      note:           order.note,
      privateNote:    order.privateNote,
      cancelReason: order.cancelReason,
      cancelledAt: order.cancelledAt,
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: order.user
        ? {
            id:        order.user.id,
            firstName: order.user.firstName ?? null,
            lastName:  order.user.lastName ?? null,
            email:     order.user.email,
            phone:     null,
          } as OrderCustomerDto
        : order.guestEmail
          ? { id: '', firstName: null, lastName: null, email: order.guestEmail, phone: null } as OrderCustomerDto
          : null,
      items,
      payment,
      statusHistory,
    };
  }
}
