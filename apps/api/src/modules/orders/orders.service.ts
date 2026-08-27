import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ProductType, Promotion } from '@prisma/client';
import { randomBytes, randomInt } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { TrackingService } from '../shipping/tracking.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AffiliateTrackingService } from '../affiliates/affiliate-tracking.service';
import { fmtDateTimeVN } from '../../common/utils/date';
import { CommissionService } from '../affiliates/commission.service';
import { PushService } from '../notifications/push.service';
import { FulfillmentConnectionStatus } from '@prisma/client';
import { FulfillmentRegistryService } from '../fulfillment/fulfillment-registry.service';
import { FulfillmentConnectionsService } from '../fulfillment/fulfillment-connections.service';
import { FulfillmentAddress, FulfillmentLineItem } from '../fulfillment/interfaces/fulfillment-provider.interface';
import { calculateOrderFees, OrderFeeSettings, PLATFORM_FEE_DEFAULTS } from '../stores/fees.util';
import { getEffectivePrices, applyBestPromo } from '../products/pricing.util';
import { AnalyticsService } from '../analytics/analytics.service';
import { BundleOffersService } from '../promotions/bundle-offers.service';
import { LinkAttributionService } from '../marketing/link-attribution.service';
import { SHARE_SAVE_REFUND_RATE } from '../marketing/marketing.constants';
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
  OrderDigitalFileDto,
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
          productType: true,
          deletedAt: true,
          storeId: true,
          shippingProfileId: true,
          // Seeds StoreOrder.shipByDate at checkout — see where the store
          // order is created.
          processingDays: true,
          images: {
            where: { type: 'MOCKUP' as const },
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
/** Retries before giving up on finding a free order number. */
const ORDER_NUMBER_ATTEMPTS = 5;

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
    private readonly fulfillmentRegistry: FulfillmentRegistryService,
    private readonly fulfillmentConnections: FulfillmentConnectionsService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    private readonly analyticsService: AnalyticsService,
    private readonly bundleOffersService: BundleOffersService,
    private readonly linkAttributionService: LinkAttributionService,
  ) {}

  // ─── Provider (Printify, etc.) shipping ─────────────────────────────────────

  /**
   * Returns a per-store shipping cost (in dollars) ONLY if every single item
   * in the cart is fulfilled by an active provider connection — i.e. the
   * customer's whole order can be quoted for real. Any gap at all (an
   * unmapped item, a disconnected connection, a provider API error/timeout)
   * returns null and the caller falls back to the seller's own Delivery
   * profile pricing instead. Deliberately all-or-nothing: splitting a single
   * quote across a partially-covered cart has no principled allocation and
   * isn't worth the complexity for phase 1.
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

    // Track checkout-started once per distinct store in the cart, at the point
    // checkout is actually attempted — not after order creation succeeds, or
    // this metric would just duplicate the "Orders" count and the funnel would
    // never show drop-off from failed/abandoned checkouts.
    const checkoutStoreIds = new Set(
      cart.items.map((item) => item.product.storeId).filter((id): id is string => !!id),
    );
    for (const storeId of checkoutStoreIds) {
      this.analyticsService.trackStoreMetric(storeId, 'checkoutStarted').catch(() => undefined);
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

    // A cart must be 100% physical or 100% digital — mixing the two would need
    // per-item shipping/fulfillment splitting with no principled allocation.
    // See dto/checkout.dto.ts for why shippingAddress is optional at the DTO
    // level: only the physical path requires it.
    const productTypes = new Set(cart.items.map((i) => i.product.productType));
    if (productTypes.size > 1) {
      throw new BadRequestException({
        code: 'ERR_MIXED_CART',
        message: 'Your cart has both physical and digital items — check out one type at a time.',
      });
    }
    const isDigitalOnly = productTypes.has(ProductType.DIGITAL);

    if (!isDigitalOnly && !dto.shippingAddress) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'shippingAddress is required',
      });
    }

    // ── Provider (Printify, etc.) shipping — computed up-front, before the total
    // is frozen, since a per-store StoreOrder isn't built until inside the
    // $transaction below (too late to still be charging the customer for it). ──
    const providerShippingCost = isDigitalOnly
      ? null
      : await this.computeProviderShippingCost(cart.items, dto.shippingAddress!);

    // Seller-configured Delivery profiles (Etsy-parity) — every physical
    // listing is required to carry one before it can be published (see
    // ProductsService.update()'s ERR_DELIVERY_INFO_REQUIRED check), so this
    // should resolve for any cart of current listings; a legacy listing that
    // predates that requirement is the only way it comes back null, in which
    // case checkout hard-errors below rather than silently mispricing.
    const sellerShipping = isDigitalOnly || providerShippingCost
      ? null
      : await this.shippingService.resolveSellerShippingCost(
          cart.items.map((item) => ({
            storeId:           item.product.storeId,
            shippingProfileId: item.product.shippingProfileId,
            quantity:          item.quantity,
          })),
          dto.shippingAddress!.country,
        );

    if (!isDigitalOnly && !providerShippingCost && !sellerShipping) {
      throw new BadRequestException({
        code: 'ERR_SHIPPING_UNRESOLVABLE',
        message: 'One or more items in your cart cannot be shipped to this address yet — please contact the seller or try a different address.',
      });
    }

    // Resolve any active auto-apply sales (Etsy "Set up a sale" — shop-wide or
    // listing-specific, no buyer code) per store present in the cart. Checkout
    // recomputes this itself rather than trusting a client-displayed sale
    // price, same discipline as the coupon-code path below.
    const cartStoreIds = [...checkoutStoreIds];
    const salePromosByProduct = new Map<string, { promotionId: string; type: string; value: number; scope: string; country: string | null }[]>();
    await Promise.all(
      cartStoreIds.map(async (sid) => {
        const productIds = cart.items
          .filter((i) => i.product.storeId === sid)
          .map((i) => i.productId);
        const result = await getEffectivePrices(this.prisma, productIds, sid, dto.shippingAddress?.country);
        for (const [pid, promos] of result) salePromosByProduct.set(pid, promos);
      }),
    );
    const unitPriceFor = (item: (typeof cart.items)[number]): number => {
      const variantPrice = item.variant?.price != null ? Number(item.variant.price) : null;
      const rawPrice = variantPrice ?? Number(item.product.basePrice);
      return applyBestPromo(rawPrice, salePromosByProduct.get(item.productId));
    };

    // Etsy "Buy them together" bundle offers — a % off the combined price,
    // only when every listing in the bundle is present in the SAME store's
    // cart together. Server-recomputed per store, same discipline as sales
    // and coupons above; never trust a client-displayed bundle price.
    const bundleDiscountByStore = new Map<string, number>();
    await Promise.all(
      cartStoreIds.map(async (sid) => {
        const storeItems = cart.items.filter((i) => i.product.storeId === sid);
        const qtyByProduct = new Map<string, number>();
        for (const item of storeItems) {
          qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
        }
        const matches = await this.bundleOffersService.findActiveMatchingBundles(sid, [...qtyByProduct.keys()]);
        let storeBundleDiscount = 0;
        for (const bundle of matches) {
          const sets = Math.min(...bundle.products.map((p) => qtyByProduct.get(p.productId) ?? 0));
          if (sets <= 0) continue;
          const setValue = bundle.products.reduce((sum, p) => {
            const item = storeItems.find((i) => i.productId === p.productId);
            return sum + (item ? unitPriceFor(item) : 0);
          }, 0);
          storeBundleDiscount += (setValue * sets * Number(bundle.discountPercent)) / 100;
        }
        if (storeBundleDiscount > 0) {
          bundleDiscountByStore.set(sid, Math.round(storeBundleDiscount * 100) / 100);
        }
      }),
    );
    const totalBundleDiscount = [...bundleDiscountByStore.values()].reduce((s, v) => s + v, 0);

    // Share & Save / Offsite Ads attribution — "last click across both kinds
    // wins" is already enforced by resolveAttribution()'s single query, so
    // each store gets at most one of the two, never both.
    const linkVisitorId = cookies?.['ezihubb_visitor'];
    const attributionByStore = new Map<string, { id: string; kind: string; sharerId: string | null }>();
    if (linkVisitorId) {
      await Promise.all(
        cartStoreIds.map(async (sid) => {
          const click = await this.linkAttributionService.resolveAttribution(linkVisitorId, sid);
          if (click) attributionByStore.set(sid, { id: click.id, kind: click.kind, sharerId: click.sharerId });
        }),
      );
    }

    // Recalculate subtotal from current prices (server-side, never trust client)
    const subtotal = cart.items.reduce((sum, item) => sum + unitPriceFor(item) * item.quantity, 0);

    // Validate coupon and calculate discount
    let discount = 0;
    let freeShipping = false;
    let couponCode: string | undefined = cart.couponCode ?? undefined;
    if (dto.couponCode) couponCode = dto.couponCode;

    // Lifted to checkout-function scope (not just the `if` block below) so the
    // $transaction's per-store allocation loop further down can see which
    // single store this coupon is scoped to — every coupon on Etsy is
    // seller-funded, so a store-scoped Promotion's discount must reduce that
    // store's own StoreOrder, not just the platform-level Order total.
    let promo: (Promotion & { products: { productId: string }[] }) | null = null;

    if (couponCode) {
      const now = new Date();
      promo = await this.prisma.promotion.findFirst({
        where: {
          code: couponCode,
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        },
        include: { products: { select: { productId: true } } },
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
      // Per-user cap — CartService.applyCoupon()/PromotionsService.validateCoupon()
      // already check this for the "preview" path, but checkout itself never
      // re-validated it, so a client could bypass the cap entirely by passing
      // dto.couponCode directly instead of going through the cart-apply step.
      if (userId) {
        const userUses = await this.prisma.promotionUsage.count({
          where: { promotionId: promo.id, userId },
        });
        if (userUses >= promo.maxUsesPerUser) {
          throw new BadRequestException({
            code: 'ERR_COUPON_USER_LIMIT',
            message: 'You have already used this coupon',
          });
        }
      }

      // A store-scoped coupon only discounts that store's items — compute the
      // discount base (and min-order check) off just that portion of the
      // cart, not the whole multi-seller subtotal, matching real-world coupon
      // scoping (a seller's coupon can't be used to discount another
      // seller's items just because they're in the same cart). A
      // SPECIFIC_LISTINGS-scoped promotion (same scope field A2 added for
      // auto-apply sales — nothing stops a coupon from using it too) must
      // further narrow the base to just its linked listings, or it would
      // silently discount the whole store instead of the intended products.
      const promoProductIds = promo.scope === 'SPECIFIC_LISTINGS'
        ? new Set(promo.products.map((p) => p.productId))
        : null;
      const promoBaseSubtotal = (promo.storeId || promoProductIds)
        ? cart.items.reduce((sum, item) => {
            if (promo!.storeId && item.product.storeId !== promo!.storeId) return sum;
            if (promoProductIds && !promoProductIds.has(item.productId)) return sum;
            return sum + unitPriceFor(item) * item.quantity;
          }, 0)
        : subtotal;

      if ((promo.storeId || promoProductIds) && promoBaseSubtotal <= 0) {
        throw new BadRequestException({
          code: 'ERR_COUPON_INVALID',
          message: 'This coupon does not apply to any items in your cart',
        });
      }
      if (
        promo.minOrderAmount !== null &&
        promoBaseSubtotal < Number(promo.minOrderAmount)
      ) {
        throw new BadRequestException({
          code: 'ERR_COUPON_MIN_ORDER',
          message: 'Order does not meet coupon minimum',
        });
      }

      if (promo.type === 'PERCENTAGE')
        discount = Math.round(promoBaseSubtotal * Number(promo.value)) / 100;
      else if (promo.type === 'FIXED_AMOUNT')
        discount = Math.min(promoBaseSubtotal, Number(promo.value));
      else if (promo.type === 'FREE_SHIPPING') freeShipping = true;
    }

    const subtotalAfterDiscount = Math.max(0, subtotal - discount - totalBundleDiscount);

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

    // Calculate shipping (waived if FREE_SHIPPING coupon applied).
    // If every item in the cart is fulfilled by a connected provider (e.g.
    // Printify), providerShippingCost holds a real per-store quote — otherwise
    // the seller-configured Delivery profile cost is used (guaranteed
    // resolvable at this point, or checkout would have hard-errored above). A
    // digital-only order never has shipping at all.
    let shippingCost: number;
    let shippingMethodName: string | null;
    if (isDigitalOnly) {
      shippingCost = 0;
      shippingMethodName = null;
    } else if (providerShippingCost) {
      shippingCost = freeShipping ? 0 : [...providerShippingCost.values()].reduce((s, c) => s + c, 0);
      shippingMethodName = 'Standard Shipping';
    } else {
      shippingCost = freeShipping ? 0 : [...sellerShipping!.perStore.values()].reduce((s, c) => s + c, 0);
      const distinctNames = new Set(sellerShipping!.methodNames.values());
      shippingMethodName = distinctNames.size === 1 ? [...distinctNames][0] : 'Standard Shipping';
    }

    // Gift wrapping is a physical concept — a digital order has nothing to wrap.
    const giftWrappingCost = !isDigitalOnly && dto.giftWrapping ? GIFT_WRAPPING_PRICE : 0;
    // Never persist a shipping address on a digital-only order, even if the
    // client sent one — isDigitalOnly is the single source of truth here.
    const addr = isDigitalOnly ? undefined : dto.shippingAddress;

    // Affiliate discount — applied AFTER coupon, BEFORE payment
    const total = Math.max(
      0,
      Math.round(
        (subtotalAfterDiscount + shippingCost + giftWrappingCost - affiliateDiscountAmount) * 100,
      ) / 100,
    );

    // Share & Save rewards go to the SHARER, a different person than whoever
    // is checking out right now — collected here and emailed after the
    // transaction commits (the Promotion code itself is still created inside
    // the transaction, atomically with everything else).
    const sharerRewards: { sharerId: string; storeId: string; storeName: string; storeSlug: string; amount: number; code: string; expiresAt: Date }[] = [];

    // $transaction: create order + items + status history + atomic coupon increment
    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber(tx);

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: userId ?? null,
          guestEmail: dto.guestEmail ?? null,
          status: OrderStatus.PENDING_PAYMENT,
          isDigital: isDigitalOnly,
          shippingName: addr ? addr.fullName : null,
          shippingPhone: addr ? addr.phone : null,
          shippingAddress: addr
            ? [addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ')
            : null,
          shippingCity: addr ? addr.city : null,
          shippingState: addr?.state ?? null,
          shippingZip: addr ? addr.postalCode : null,
          shippingCountry: addr ? addr.country : null,
          shippingMethod: shippingMethodName,
          shippingCost,
          subtotal:       Math.round(subtotal * 100) / 100,
          discountAmount: Math.round((discount + totalBundleDiscount) * 100) / 100,
          total,
          couponCode:     couponCode ?? null,
          isGift:         dto.isGift ?? false,
          giftMessage:    dto.isGift ? (dto.giftMessage ?? null) : null,
          giftFrom:       dto.isGift ? (dto.giftFrom ?? null) : null,
          giftReceipt:    dto.isGift ? (dto.giftReceipt ?? false) : false,
          giftWrapping:            !isDigitalOnly && (dto.giftWrapping ?? false),
          note:                    dto.note ?? null,
          affiliateId:              affiliateId,
          affiliateDiscountAmount:  affiliateDiscountAmount > 0 ? affiliateDiscountAmount : undefined,
        },
      });

      // Snapshot current prices and product data into order items
      await tx.orderItem.createMany({
        data: cart.items.map((item) => ({
          orderId:          newOrder.id,
          productId:        item.productId,
          variantId:        item.variantId,
          quantity:         item.quantity,
          unitPrice:        unitPriceFor(item),
          customizationData: item.customizationData as
            | Prisma.InputJsonValue
            | undefined,
          previewUrl:       item.previewUrl,
          searchTerm:       item.searchTerm,
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
          transactionFeeRate:        Number(platformSettings?.transactionFeeRate        ?? PLATFORM_FEE_DEFAULTS.transactionFeeRate),
          paymentProcessingFeeRate:  Number(platformSettings?.paymentProcessingFeeRate  ?? PLATFORM_FEE_DEFAULTS.paymentProcessingFeeRate),
          paymentProcessingFixedFee: Number(platformSettings?.paymentProcessingFixedFee ?? PLATFORM_FEE_DEFAULTS.paymentProcessingFixedFee),
          regulatoryFeeRate:         Number(platformSettings?.regulatoryFeeRate         ?? PLATFORM_FEE_DEFAULTS.regulatoryFeeRate),
          regulatoryFeeCountries:    platformSettings?.regulatoryFeeCountries           ?? PLATFORM_FEE_DEFAULTS.regulatoryFeeCountries,
          vatOnFeesRate:             Number(platformSettings?.vatOnFeesRate             ?? PLATFORM_FEE_DEFAULTS.vatOnFeesRate),
        };
        const offsiteAdsFeeRate = Number(platformSettings?.offsiteAdsFeeRate ?? PLATFORM_FEE_DEFAULTS.offsiteAdsFeeRate);

        const storeRecords = await tx.store.findMany({
          where:  { id: { in: [...storeGroups.keys()] } },
          select: { id: true, name: true, slug: true, country: true, offsiteAdsOptedOut: true, shareSaveEnabled: true },
        });
        const storeCountryMap = new Map(storeRecords.map(s => [s.id, s.country]));
        const storeOptOutMap = new Map(storeRecords.map(s => [s.id, s.offsiteAdsOptedOut]));
        const storeInfoMap = new Map(storeRecords.map(s => [s.id, { name: s.name, slug: s.slug }]));
        const storeShareSaveMap = new Map(storeRecords.map(s => [s.id, s.shareSaveEnabled]));

        for (const [storeId, items] of storeGroups) {
          const storeSubtotal = items.reduce((sum, item) => sum + unitPriceFor(item) * item.quantity, 0);
          const roundedSubtotal = Math.round(storeSubtotal * 100) / 100;
          const storeShippingCost = freeShipping
            ? 0
            : (providerShippingCost?.get(storeId) ?? sellerShipping?.perStore.get(storeId) ?? 0);

          // Every discount on Etsy is seller-funded — a store-scoped coupon's
          // discount reduces THAT store's own subtotal (and therefore fees +
          // seller earnings + the SALE ledger credit), never the platform's.
          // A platform-wide coupon (promo.storeId === null) is left absorbed
          // at the platform level exactly as before — that's an admin-created
          // case with no Etsy-parity equivalent, not touched by this fix.
          const couponDiscount = promo?.storeId === storeId ? Math.min(discount, roundedSubtotal) : 0;
          const storeBundleDiscount = bundleDiscountByStore.get(storeId) ?? 0;
          const storeDiscount = Math.min(couponDiscount + storeBundleDiscount, roundedSubtotal);
          const discountedSubtotal = Math.round((roundedSubtotal - storeDiscount) * 100) / 100;

          const fees = calculateOrderFees(discountedSubtotal, storeShippingCost, storeCountryMap.get(storeId), feeSettings);

          // The dispatch promise, from the slowest item in this store's part
          // of the order — the parcel cannot leave before the last thing in it
          // is made. Calendar days, not business days: the seller can move the
          // date afterwards, and a promise that quietly stretches over
          // weekends is one the buyer did not agree to.
          //
          // Null for a digital order: there is no parcel to dispatch, and a
          // date on one would age into "Overdue" and raise an alarm about work
          // that does not exist.
          const processingDays = Math.max(
            ...items.map((item) => item.product.processingDays ?? 0),
            0,
          );
          const shipByDate = newOrder.isDigital
            ? null
            : new Date(Date.now() + processingDays * 24 * 60 * 60 * 1000);

          const storeOrder = await tx.storeOrder.create({
            data: {
              orderId:        newOrder.id,
              storeId,
              status:         OrderStatus.PENDING_PAYMENT,
              shipByDate,
              subtotal:       roundedSubtotal,
              discountAmount: storeDiscount,
              platformFee:    fees.totalFees,
              sellerEarnings: fees.sellerEarnings,
              shippingCost:   storeShippingCost,
              visitorId:      linkVisitorId ?? null,
            },
          });

          const ledgerEntries: Prisma.SellerLedgerEntryCreateManyInput[] = [
            {
              storeId, storeOrderId: storeOrder.id, type: 'SALE',
              amount: discountedSubtotal + storeShippingCost,
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
          if (fees.vatOnFees > 0) {
            ledgerEntries.push({
              storeId, storeOrderId: storeOrder.id, type: 'VAT',
              amount: -fees.vatOnFees,
              description: `VAT on seller fees — order ${newOrder.orderNumber}`,
            });
          }

          const attribution = attributionByStore.get(storeId);
          // A valid Share & Save reward requires a REAL sharer identity, and
          // that sharer must not be the person checking out right now — a
          // generic/missing sharerId (e.g. someone hand-appending `?ss=1`
          // with no real link) earns nothing, which is what stops anyone
          // self-serving a discount instead of genuinely referring someone.
          const validSharerId = attribution?.kind === 'SHARE_SAVE' && attribution.sharerId && attribution.sharerId !== userId
            ? attribution.sharerId
            : null;
          if (validSharerId && storeShareSaveMap.get(storeId)) {
            // Seller-funded, same as every other discount in this codebase —
            // the sharer gets 4% back, which comes out of THIS store's
            // earnings, not extra revenue for them. A positive entry here
            // would incorrectly overpay the seller.
            const rewardAmount = Math.round(discountedSubtotal * SHARE_SAVE_REFUND_RATE * 100) / 100;
            ledgerEntries.push({
              storeId, storeOrderId: storeOrder.id, type: 'SHARE_SAVE_REFUND',
              amount: -rewardAmount,
              description: `Share & Save credit — order ${newOrder.orderNumber}`,
            });

            if (rewardAmount > 0) {
              const code = `SHARE-${randomBytes(4).toString('hex').toUpperCase()}`;
              const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
              await tx.promotion.create({
                data: {
                  code, type: 'FIXED_AMOUNT', value: rewardAmount,
                  maxUses: 1, maxUsesPerUser: 1,
                  storeId, scope: 'SHOP_WIDE',
                  targetUserId: validSharerId,
                  expiresAt,
                  description: `share-save:${storeOrder.id}`,
                },
              });
              const storeInfo = storeInfoMap.get(storeId);
              if (storeInfo) {
                sharerRewards.push({
                  sharerId: validSharerId, storeId, storeName: storeInfo.name, storeSlug: storeInfo.slug,
                  amount: rewardAmount, code, expiresAt,
                });
              }
            }
          } else if (attribution?.kind === 'OFFSITE_AD' && !storeOptOutMap.get(storeId)) {
            ledgerEntries.push({
              storeId, storeOrderId: storeOrder.id, type: 'OFFSITE_ADS_FEE',
              amount: -Math.round(discountedSubtotal * offsiteAdsFeeRate * 100) / 100,
              description: `Offsite Ads fee — order ${newOrder.orderNumber}`,
            });
          }

          await tx.sellerLedgerEntry.createMany({ data: ledgerEntries });
          if (attribution) {
            await this.linkAttributionService.markConverted(attribution.id, newOrder.id, tx);
          }

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

      // Record promotion usage — including guest checkouts (userId: null).
      // Previously this only ran `&& userId`, so a guest's use of a coupon
      // was silently invisible to admin stats (getStats()/getPageStats()
      // both derive entirely from PromotionUsage) despite the discount and
      // the atomic currentUses increment above both still applying.
      if (couponCode) {
        await tx.promotionUsage.create({
          data: { promotionId: promo!.id, userId: userId ?? null, orderId: newOrder.id },
        });
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

    // Email each Share & Save sharer their reward code — the codes themselves
    // were already created atomically inside the transaction above; sending
    // the email is a non-critical side effect, done after commit.
    for (const reward of sharerRewards) {
      this.prisma.user.findUnique({ where: { id: reward.sharerId }, select: { email: true, firstName: true } })
        .then((sharer) => {
          if (!sharer) return;
          return this.emailQueue.add(JOBS.SEND_EMAIL, {
            to: sharer.email,
            template: 'targeted-offer',
            subject: `You earned $${reward.amount.toFixed(2)} for sharing ${reward.storeName}!`,
            data: {
              storeName: reward.storeName,
              firstName: sharer.firstName ?? 'there',
              headline: 'Your share paid off!',
              message: `Someone bought from ${reward.storeName} through your Share & Save link — here's your instant credit.`,
              code: reward.code,
              discountLabel: `$${reward.amount.toFixed(2)}`,
              expiresAt: reward.expiresAt.toLocaleDateString(),
              shopUrl: `${process.env['CLIENT_URL'] ?? 'https://ezihubb.com'}/shops/${reward.storeSlug}`,
              year: new Date().getFullYear(),
            },
          }, DEFAULT_JOB_OPTIONS);
        })
        .catch((err: Error) => this.logger.warn(`Failed to queue Share & Save reward email: ${err.message}`));
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
      shippingName: o.shippingName ?? undefined,
      shippingCity: o.shippingCity ?? undefined,
      shippingCountry: o.shippingCountry ?? undefined,
      shippingMethod: o.shippingMethod ?? undefined,
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

    /**
     * COMPLETED is owned by the progress-step machine, not by this route.
     *
     * This method writes Order.status and nothing else. Setting COMPLETED
     * here left StoreOrder.status and progressStepId behind, and the
     * seller's queue reads both — the tab is filtered on the step, the
     * badge on the status — so one order would contradict itself on
     * screen. Completing an order means moving it to the pipeline's
     * COMPLETED step, which sets all three and promotes the parent order
     * once every shop in the basket is done.
     *
     * CANCELLED and REFUNDED stay allowed on purpose: both are in
     * OFF_QUEUE_STATUSES, so the order leaves the queue entirely and
     * there is no badge left to disagree with a tab.
     */
    if (dto.status === OrderStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'ERR_COMPLETE_VIA_STEPS',
        message: 'Move the order to the Completed step instead of setting the status directly.',
      });
    }

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
          // The date the seller says the carrier gets it, not the moment they
          // pressed the button. A shop packing on Friday for a Monday
          // collection was stamped Friday, and the buyer's tracking email
          // claimed a dispatch that had not happened yet.
          shippedAt:      dto.dispatchedAt ? new Date(dto.dispatchedAt) : now,
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

  /**
   * "EZH-123456" — six random digits, no sequence.
   *
   * The old format was MLH-<year>-<00001> from a Postgres sequence, which made
   * every order number guessable and leaked the shop's total order count to
   * anyone who placed one. Random removes both.
   *
   * `randomInt` from node:crypto, not Math.random: order numbers are quoted in
   * the tracking form beside an email, so they should not be predictable from
   * one another.
   *
   * Retried on collision rather than trusted. A million values is small enough
   * that birthday collisions arrive far sooner than intuition suggests, and
   * `orderNumber` is UNIQUE — an unhandled clash would abort a checkout that
   * had already taken payment. The retry runs inside the caller's transaction,
   * so the read and the eventual insert see the same snapshot.
   */
  private async generateOrderNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt++) {
      const candidate = `EZH-${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
      const taken = await tx.order.findUnique({
        where:  { orderNumber: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    // Better than returning a number that will fail the unique index further
    // in, where the message would say nothing about what actually went wrong.
    throw new ConflictException({
      code:    'ERR_ORDER_NUMBER',
      message: 'Could not allocate an order number. Please try again.',
    });
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

  // `getEarnings(orderId)` was removed, along with GET /admin/orders/:id/earnings.
  //
  // It answered for the whole Order while OrderOwnershipGuard only asks "is
  // this shop ONE of its vendors" — so on a basket split across shops it
  // handed one seller the other seller's revenue. It also hardcoded 5% and
  // 3%+$0.25, while real fees come from PlatformSettings (6.5% / 5% plus a
  // regulatory fee and VAT), so the numbers did not match what anyone is paid
  // either.
  //
  // SellerOrderDetailService.getEarnings(storeId, storeOrderId) replaces it:
  // scoped to one StoreOrder, and read from SellerLedgerEntry, which is what
  // payouts are actually batched from.

  private async mapToDto(
    order: Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>,
  ): Promise<OrderResponseDto> {
    // Digital deliverables only ever surface once the order is COMPLETED —
    // mirrors the download endpoint's own access gate (order-downloads.controller.ts)
    // so the UI never shows a download link that would 403.
    const digitalFilesByProduct = new Map<string, OrderDigitalFileDto[]>();
    if (order.isDigital && order.status === OrderStatus.COMPLETED) {
      const productIds = [...new Set(order.items.map((i) => i.productId).filter((id): id is string => !!id))];
      if (productIds.length > 0) {
        const files = await this.prisma.digitalFile.findMany({
          where: { productId: { in: productIds } },
          orderBy: { sortOrder: 'asc' },
        });
        for (const f of files) {
          const entry: OrderDigitalFileDto = {
            id: f.id,
            filename: f.filename,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            downloadUrl: `/orders/${order.orderNumber}/downloads/${f.id}`,
          };
          if (!digitalFilesByProduct.has(f.productId)) digitalFilesByProduct.set(f.productId, []);
          digitalFilesByProduct.get(f.productId)!.push(entry);
        }
      }
    }

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
      digitalFiles: i.productId ? digitalFilesByProduct.get(i.productId) : undefined,
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
      isDigital: order.isDigital,
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
