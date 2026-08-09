import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { TrackingService } from '../shipping/tracking.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AffiliateTrackingService } from '../affiliates/affiliate-tracking.service';
import { fmtDateTimeVN } from '../../common/utils/date';
import { CommissionService } from '../affiliates/commission.service';
import { PushService } from '../notifications/push.service';
import { ReferralService } from '../referrals/referral.service';
import { FulfillmentConnectionStatus } from '@prisma/client';
import { FulfillmentRegistryService } from '../fulfillment/fulfillment-registry.service';
import { FulfillmentConnectionsService } from '../fulfillment/fulfillment-connections.service';
import { FulfillmentAddress, FulfillmentLineItem } from '../fulfillment/interfaces/fulfillment-provider.interface';
import { calculateOrderFees, OrderFeeSettings } from '../stores/fees.util';
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
    private readonly affiliateTrackingService: AffiliateTrackingService,
    private readonly commissionService: CommissionService,
    private readonly pushService: PushService,
    private readonly referralService: ReferralService,
    private readonly fulfillmentRegistry: FulfillmentRegistryService,
    private readonly fulfillmentConnections: FulfillmentConnectionsService,
  ) {}

  // ─── Provider (Printify, etc.) shipping ─────────────────────────────────────

  /**
   * Returns a per-store shipping cost (in dollars) ONLY if every single item
   * in the cart is fulfilled by an active provider connection — i.e. the
   * customer's whole order can be quoted for real. Any gap at all (an
   * unmapped item, a disconnected connection, a provider API error/timeout)
   * returns null and the caller falls back entirely to the existing flat
   * ShippingMethod behavior, unchanged. Deliberately all-or-nothing: splitting
   * a single flat rate across a partially-covered cart has no principled
   * allocation and isn't worth the complexity for phase 1.
   */
  private async computeProviderShippingCost(
    items: Array<{
      productId: string;
      variantId: string | null;
      quantity:  number;
      product:   { storeId: string | null };
    }>,
    address: FulfillmentAddress,
  ): Promise<Map<string, number> | null> {
    const storeGroups = new Map<string, typeof items>();
    for (const item of items) {
      const sid = item.product.storeId;
      if (!sid) return null; // no store → definitely not provider-fulfilled
      if (!storeGroups.has(sid)) storeGroups.set(sid, []);
      storeGroups.get(sid)!.push(item);
    }

    const mappings = await this.prisma.productFulfillmentMapping.findMany({
      where: { OR: items.map((i) => ({ productId: i.productId, variantId: i.variantId })) },
      include: { connection: { select: { id: true, provider: true, status: true } } },
    });
    const mappingFor = (productId: string, variantId: string | null) =>
      mappings.find((m) => m.productId === productId && m.variantId === variantId);

    const result = new Map<string, number>();

    for (const [storeId, groupItems] of storeGroups) {
      const resolved = groupItems.map((i) => mappingFor(i.productId, i.variantId));
      if (resolved.some((m) => !m || m.connection.status !== FulfillmentConnectionStatus.ACTIVE)) {
        return null; // this store group has at least one unmapped/disconnected item
      }

      const connectionId = resolved[0]!.connection.id;
      if (resolved.some((m) => m!.connection.id !== connectionId)) {
        // Items in this store map to >1 provider connection — no single rate
        // quote covers the whole group; fall back rather than guess.
        return null;
      }

      const lineItems: FulfillmentLineItem[] = resolved.map((m, idx) => ({
        externalProductId: m!.externalProductId,
        externalVariantId: m!.externalVariantId,
        quantity:           groupItems[idx]!.quantity,
      }));

      try {
        const conn        = await this.fulfillmentConnections.getDecryptedConnection(connectionId);
        const providerImpl = this.fulfillmentRegistry.resolve(conn.provider);
        const cents        = await providerImpl.getShippingRateCents(conn, lineItems, address);
        result.set(storeId, cents / 100);
      } catch (err) {
        this.logger.warn(`Provider shipping rate failed for store ${storeId}, falling back to flat rate: ${(err as Error).message}`);
        return null; // a provider outage must never block checkout
      }
    }

    return result;
  }

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

    // ── Provider (Printify, etc.) shipping — computed up-front, before the total
    // is frozen, since a per-store StoreOrder isn't built until inside the
    // $transaction below (too late to still be charging the customer for it). ──
    const providerShippingCost = await this.computeProviderShippingCost(cart.items, dto.shippingAddress);

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

    // Calculate shipping (waived if FREE_SHIPPING coupon applied).
    // If every item in the cart is fulfilled by a connected provider (e.g.
    // Printify), providerShippingCost holds a real per-store quote and we skip
    // the flat ShippingMethod entirely — otherwise (the common case today)
    // fall back to the existing flat-rate behavior unchanged.
    let shippingCost: number;
    let shippingMethodName: string;
    if (providerShippingCost) {
      shippingCost = freeShipping ? 0 : [...providerShippingCost.values()].reduce((s, c) => s + c, 0);
      shippingMethodName = 'Standard Shipping';
    } else {
      const shippingCalc = await this.shippingService.calculateShipping(
        dto.shippingMethodId,
        subtotalAfterDiscount,
      );
      shippingCost = freeShipping ? 0 : shippingCalc.cost;
      shippingMethodName = shippingCalc.name;
    }

    const giftWrappingCost = dto.giftWrapping ? GIFT_WRAPPING_PRICE : 0;
    const { shippingAddress: addr } = dto;

    // Affiliate + referral discounts — applied AFTER coupon, BEFORE payment
    const total = Math.max(
      0,
      Math.round(
        (subtotalAfterDiscount + shippingCost + giftWrappingCost - affiliateDiscountAmount - referralDiscountAmt) * 100,
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
        const feeSettings: OrderFeeSettings = {
          transactionFeeRate:        Number(platformSettings?.transactionFeeRate ?? 0.065),
          paymentProcessingFeeRate:  Number(platformSettings?.paymentProcessingFeeRate ?? 0.05),
          paymentProcessingFixedFee: Number(platformSettings?.paymentProcessingFixedFee ?? 0.25),
          regulatoryFeeRate:         Number(platformSettings?.regulatoryFeeRate ?? 0.0124),
          regulatoryFeeCountries:    platformSettings?.regulatoryFeeCountries ?? [],
        };

        const storeRecords = await tx.store.findMany({
          where:  { id: { in: [...storeGroups.keys()] } },
          select: { id: true, country: true },
        });
        const storeCountryMap = new Map(storeRecords.map(s => [s.id, s.country]));

        for (const [storeId, items] of storeGroups) {
          const storeSubtotal = items.reduce((sum, item) => {
            const vp = item.variant ? Number(item.variant.price) : 0;
            const price = vp > 0 ? vp : Number(item.product.basePrice);
            return sum + price * item.quantity;
          }, 0);
          const roundedSubtotal = Math.round(storeSubtotal * 100) / 100;
          const storeShippingCost = freeShipping ? 0 : (providerShippingCost?.get(storeId) ?? 0);

          const fees = calculateOrderFees(roundedSubtotal, storeShippingCost, storeCountryMap.get(storeId), feeSettings);

          const storeOrder = await tx.storeOrder.create({
            data: {
              orderId:        newOrder.id,
              storeId,
              status:         OrderStatus.PENDING_PAYMENT,
              subtotal:       roundedSubtotal,
              platformFee:    fees.totalFees,
              sellerEarnings: fees.sellerEarnings,
              shippingCost:   storeShippingCost,
            },
          });

          const ledgerEntries: Prisma.SellerLedgerEntryCreateManyInput[] = [
            {
              storeId, storeOrderId: storeOrder.id, type: 'SALE',
              amount: roundedSubtotal + storeShippingCost,
              description: `Sale — order ${newOrder.orderNumber}`,
            },
            {
              storeId, storeOrderId: storeOrder.id, type: 'TRANSACTION_FEE',
              amount: -fees.transactionFee,
              description: `Transaction fee — order ${newOrder.orderNumber}`,
            },
            {
              storeId, storeOrderId: storeOrder.id, type: 'PAYMENT_PROCESSING_FEE',
              amount: -fees.paymentProcessingFee,
              description: `Payment processing fee — order ${newOrder.orderNumber}`,
            },
          ];
          if (fees.regulatoryFee > 0) {
            ledgerEntries.push({
              storeId, storeOrderId: storeOrder.id, type: 'REGULATORY_FEE',
              amount: -fees.regulatoryFee,
              description: `Regulatory operating fee — order ${newOrder.orderNumber}`,
            });
          }
          await tx.sellerLedgerEntry.createMany({ data: ledgerEntries });

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

      return newOrder;
    });

    // Mark affiliate click as converted now that we have the orderId
    if (affiliateId && visitorId) {
      this.affiliateTrackingService
        .markClickConverted(visitorId, affiliateId, order.id)
        // eslint-disable-next-line @typescript-eslint/no-empty-function
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
    const affiliateDisc    = Number(order.affiliateDiscountAmount ?? 0);
    const referralDisc     = Number(order.referralDiscountAmount ?? 0);
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
