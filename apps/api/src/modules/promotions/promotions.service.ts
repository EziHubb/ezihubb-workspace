import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DiscountType, PromotionScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedResult,
  paginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
} from './dto/create-promotion.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import {
  CouponValidationResultDto,
  PromotionResponseDto,
  PromotionStatsDto,
} from './dto/promotion-response.dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  /**
   * Validates a coupon without consuming it.
   * Returns validation result with calculated discount amount.
   */
  async validateCoupon(
    dto: ValidateCouponDto,
    userId?: string,
  ): Promise<CouponValidationResultDto> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (!promotion || !promotion.isActive) {
      throw new BadRequestException({
        code: 'ERR_COUPON_INVALID',
        message: 'Coupon code is invalid or inactive',
      });
    }

    const now = new Date();
    if (promotion.startsAt && now < promotion.startsAt) {
      throw new BadRequestException({
        code: 'ERR_COUPON_NOT_YET_ACTIVE',
        message: 'This coupon is not yet active',
      });
    }
    if (promotion.expiresAt && now > promotion.expiresAt) {
      throw new BadRequestException({
        code: 'ERR_COUPON_EXPIRED',
        message: 'This coupon has expired',
      });
    }
    if (
      promotion.maxUses !== null &&
      promotion.currentUses >= promotion.maxUses
    ) {
      throw new BadRequestException({
        code: 'ERR_COUPON_EXHAUSTED',
        message: 'This coupon has reached its usage limit',
      });
    }
    if (
      promotion.minOrderAmount !== null &&
      dto.orderTotal < Number(promotion.minOrderAmount)
    ) {
      throw new BadRequestException({
        code: 'ERR_COUPON_MIN_ORDER',
        message: `Minimum order amount of $${Number(promotion.minOrderAmount).toFixed(2)} required`,
      });
    }

    // Per-user usage check
    if (userId) {
      const userUses = await this.prisma.promotionUsage.count({
        where: { promotionId: promotion.id, userId },
      });
      if (userUses >= promotion.maxUsesPerUser) {
        throw new BadRequestException({
          code: 'ERR_COUPON_USER_LIMIT',
          message: 'You have already used this coupon',
        });
      }
    }

    const discountAmount = this.calcDiscount(
      promotion.type,
      Number(promotion.value),
      dto.orderTotal,
    );

    return {
      valid: true,
      code: promotion.code!,
      type: promotion.type,
      value: Number(promotion.value),
      discountAmount,
      description: promotion.description,
    };
  }

  /**
   * Atomically increments coupon use count inside a Prisma transaction.
   * Returns affected rows; 0 means the coupon was exhausted (race condition).
   * Throws BadRequestException if 0 rows affected.
   */
  async useCoupon(code: string, tx: Prisma.TransactionClient): Promise<void> {
    const affected = await tx.$executeRaw`
      UPDATE "Promotion"
      SET "currentUses" = "currentUses" + 1
      WHERE code = ${code}
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

  // ── Admin CRUD ───────────────────────────────────────────────────────────────

  async create(dto: CreatePromotionDto, storeId?: string): Promise<PromotionResponseDto> {
    if (!dto.autoApply && !dto.code) {
      throw new BadRequestException({
        code: 'ERR_COUPON_CODE_REQUIRED',
        message: 'A coupon code is required unless autoApply is true',
      });
    }
    if (dto.scope === PromotionScope.SPECIFIC_LISTINGS && !dto.productIds?.length) {
      throw new BadRequestException({
        code: 'ERR_PROMOTION_LISTINGS_REQUIRED',
        message: 'At least one listing must be selected for a listing-specific promotion',
      });
    }

    const code = dto.code ? dto.code.toUpperCase() : null;
    if (code) {
      const existing = await this.prisma.promotion.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException({
          code: 'ERR_COUPON_CODE_TAKEN',
          message: 'Coupon code already exists',
        });
      }
    }

    const promotion = await this.prisma.promotion.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount ?? null,
        maxUses: dto.maxUses ?? null,
        maxUsesPerUser: dto.maxUsesPerUser ?? 1,
        startsAt: dto.startsAt ?? null,
        expiresAt: dto.expiresAt ?? null,
        description: dto.description ?? null,
        // storeId undefined (platform context) → a platform-wide coupon, same as before.
        // storeId set (a store owner, or SUPER_ADMIN in their own store context, or a
        // platform-context SUPER_ADMIN who explicitly picked a store) → scoped to that store.
        storeId: storeId ?? null,
        autoApply: dto.autoApply ?? false,
        scope: dto.scope ?? PromotionScope.SHOP_WIDE,
        country: dto.country ?? null,
        termsAndConditions: dto.termsAndConditions ?? null,
        ...(dto.scope === PromotionScope.SPECIFIC_LISTINGS && dto.productIds?.length
          ? { products: { create: dto.productIds.map((productId) => ({ productId })) } }
          : {}),
      },
      include: {
        store: { select: { id: true, name: true, slug: true } },
        products: { select: { productId: true } },
      },
    });

    return this.mapToDto(promotion);
  }

  async findAll(
    query: PromotionQueryDto,
    storeId?: string,
  ): Promise<PaginatedResult<PromotionResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where: Prisma.PromotionWhereInput = storeId !== undefined ? { storeId } : {};

    if (query.q) {
      where.code = { contains: query.q, mode: 'insensitive' };
    }
    if (query.type) {
      where.type = query.type;
    }
    // Mirrors the admin UI's own derived-status logic exactly (getStatus() in
    // apps/admin/.../promotions/page.tsx): EXPIRED beats PAUSED beats
    // SCHEDULED beats ACTIVE, so the same precedence has to be reproduced
    // here rather than just checking isActive/startsAt/expiresAt independently.
    if (query.status) {
      const now = new Date();
      if (query.status === 'EXPIRED') {
        where.expiresAt = { lt: now };
      } else if (query.status === 'PAUSED') {
        where.isActive = false;
        where.OR = [{ expiresAt: null }, { expiresAt: { gte: now } }];
      } else if (query.status === 'SCHEDULED') {
        where.isActive = true;
        where.startsAt = { gt: now };
        where.AND = [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }];
      } else if (query.status === 'ACTIVE') {
        where.isActive = true;
        where.AND = [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ];
      }
    }

    const [promotions, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        include: {
          store: { select: { id: true, name: true, slug: true } },
          products: { select: { productId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return paginatedResponse(promotions.map(this.mapToDto), page, limit, total);
  }

  /** storeId undefined = platform context (no ownership check); set = must match exactly. */
  async findOne(id: string, storeId?: string): Promise<PromotionResponseDto> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, slug: true } },
        products: { select: { productId: true } },
      },
    });
    if (!promotion || (storeId !== undefined && promotion.storeId !== storeId))
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Promotion not found',
      });
    return this.mapToDto(promotion);
  }

  async update(
    id: string,
    dto: UpdatePromotionDto,
    storeId?: string,
  ): Promise<PromotionResponseDto> {
    await this.findOne(id, storeId);

    if (dto.code) {
      const code = dto.code.toUpperCase();
      const conflict = await this.prisma.promotion.findFirst({
        where: { code, id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException({
          code: 'ERR_COUPON_CODE_TAKEN',
          message: 'Coupon code already exists',
        });
      }
      dto.code = code;
    }

    if (dto.scope === PromotionScope.SPECIFIC_LISTINGS && dto.productIds && dto.productIds.length === 0) {
      throw new BadRequestException({
        code: 'ERR_PROMOTION_LISTINGS_REQUIRED',
        message: 'At least one listing must be selected for a listing-specific promotion',
      });
    }

    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.minOrderAmount !== undefined && {
          minOrderAmount: dto.minOrderAmount,
        }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.maxUsesPerUser !== undefined && {
          maxUsesPerUser: dto.maxUsesPerUser,
        }),
        ...(dto.startsAt !== undefined && { startsAt: dto.startsAt }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.autoApply !== undefined && { autoApply: dto.autoApply }),
        ...(dto.scope !== undefined && { scope: dto.scope }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.termsAndConditions !== undefined && { termsAndConditions: dto.termsAndConditions }),
        ...(dto.productIds !== undefined && {
          products: {
            deleteMany: {},
            create: dto.productIds.map((productId) => ({ productId })),
          },
        }),
      },
      include: {
        store: { select: { id: true, name: true, slug: true } },
        products: { select: { productId: true } },
      },
    });

    return this.mapToDto(promotion);
  }

  async patch(
    id: string,
    dto: UpdatePromotionDto & { isActive?: boolean },
    storeId?: string,
  ): Promise<PromotionResponseDto> {
    await this.findOne(id, storeId);

    if (dto.code) {
      const code = dto.code.toUpperCase();
      const conflict = await this.prisma.promotion.findFirst({
        where: { code, id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException({
          code: 'ERR_COUPON_CODE_TAKEN',
          message: 'Coupon code already exists',
        });
      }
      dto.code = code;
    }

    if (dto.scope === PromotionScope.SPECIFIC_LISTINGS && dto.productIds && dto.productIds.length === 0) {
      throw new BadRequestException({
        code: 'ERR_PROMOTION_LISTINGS_REQUIRED',
        message: 'At least one listing must be selected for a listing-specific promotion',
      });
    }

    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.minOrderAmount !== undefined && { minOrderAmount: dto.minOrderAmount }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.maxUsesPerUser !== undefined && { maxUsesPerUser: dto.maxUsesPerUser }),
        ...(dto.startsAt !== undefined && { startsAt: dto.startsAt }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.autoApply !== undefined && { autoApply: dto.autoApply }),
        ...(dto.scope !== undefined && { scope: dto.scope }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.termsAndConditions !== undefined && { termsAndConditions: dto.termsAndConditions }),
        ...(dto.productIds !== undefined && {
          products: {
            deleteMany: {},
            create: dto.productIds.map((productId) => ({ productId })),
          },
        }),
      },
      include: {
        store: { select: { id: true, name: true, slug: true } },
        products: { select: { productId: true } },
      },
    });

    return this.mapToDto(promotion);
  }

  async remove(id: string, storeId?: string): Promise<void> {
    await this.findOne(id, storeId);
    await this.prisma.promotion.delete({ where: { id } });
  }

  async getPageStats(storeId?: string): Promise<{
    activeCoupons: number;
    usedToday: number;
    revenueDiscounted: number;
    avgDiscountValue: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const promotionFilter = storeId !== undefined ? { storeId } : {};

    const [activeCoupons, usedToday, usages] = await Promise.all([
      this.prisma.promotion.count({ where: { isActive: true, ...promotionFilter } }),
      this.prisma.promotionUsage.count({ where: { usedAt: { gte: todayStart }, promotion: promotionFilter } }),
      this.prisma.promotionUsage.findMany({
        where: { promotion: promotionFilter },
        include: { order: { select: { discountAmount: true } } },
        orderBy: { usedAt: 'desc' },
        take: 5000,
      }),
    ]);

    const revenueDiscounted = usages.reduce(
      (sum, u) => sum + Number(u.order.discountAmount),
      0,
    );
    const avgDiscountValue = usages.length > 0 ? revenueDiscounted / usages.length : 0;

    return { activeCoupons, usedToday, revenueDiscounted, avgDiscountValue };
  }

  async deactivate(id: string, storeId?: string): Promise<PromotionResponseDto> {
    await this.findOne(id, storeId);
    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });
    return this.mapToDto(promotion);
  }

  async getStats(id: string, storeId?: string): Promise<PromotionStatsDto> {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promotion || (storeId !== undefined && promotion.storeId !== storeId))
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Promotion not found',
      });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Two separate queries rather than one `include` with `take: 20` — the
    // aggregates (total discount, avg order size, top user, daily chart) need
    // every usage, not just the 20 most recent shown in the table below.
    const [allUsages, recentUsages] = await Promise.all([
      this.prisma.promotionUsage.findMany({
        where: { promotionId: id },
        select: {
          userId: true,
          usedAt: true,
          order: {
            select: {
              total: true,
              discountAmount: true,
              guestEmail: true,
              user: { select: { email: true } },
            },
          },
        },
      }),
      this.prisma.promotionUsage.findMany({
        where: { promotionId: id },
        orderBy: { usedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          orderId: true,
          usedAt: true,
          order: {
            select: {
              orderNumber: true,
              discountAmount: true,
              guestEmail: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
    ]);

    const totalDiscount = allUsages.reduce((sum, u) => sum + Number(u.order.discountAmount), 0);
    const avgOrderSize = allUsages.length > 0
      ? allUsages.reduce((sum, u) => sum + Number(u.order.total), 0) / allUsages.length
      : 0;

    // Top user by usage count — grouped by userId when present, else the
    // guest email (guest checkouts have no userId but still count).
    const userKey = (u: (typeof allUsages)[number]) => u.userId ?? u.order.guestEmail ?? u.order.user?.email ?? 'unknown';
    const userCounts = new Map<string, number>();
    const userEmails = new Map<string, string | undefined>();
    for (const u of allUsages) {
      const key = userKey(u);
      userCounts.set(key, (userCounts.get(key) ?? 0) + 1);
      userEmails.set(key, u.order.user?.email ?? u.order.guestEmail ?? undefined);
    }
    let topUserEmail: string | undefined;
    let topUserUses = 0;
    for (const [key, count] of userCounts) {
      if (count > topUserUses) {
        topUserUses = count;
        topUserEmail = userEmails.get(key);
      }
    }

    const dailyMap = new Map<string, number>();
    for (const u of allUsages) {
      if (u.usedAt < thirtyDaysAgo) continue;
      const day = u.usedAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
    const dailyUsage = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      totalUsed: promotion.currentUses,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      avgOrderSize: Math.round(avgOrderSize * 100) / 100,
      topUserEmail,
      topUserUses: topUserUses > 0 ? topUserUses : undefined,
      dailyUsage,
      recentUsages: recentUsages.map((u) => ({
        id: u.id,
        customerName: u.order.user
          ? (`${u.order.user.firstName ?? ''} ${u.order.user.lastName ?? ''}`.trim() || u.order.user.email)
          : 'Guest',
        customerEmail: u.order.user?.email ?? u.order.guestEmail ?? '',
        orderId: u.orderId,
        orderNumber: u.order.orderNumber,
        discountAmount: Number(u.order.discountAmount),
        usedAt: u.usedAt,
      })),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  calcDiscount(type: DiscountType, value: number, subtotal: number): number {
    if (type === DiscountType.PERCENTAGE)
      return Math.round(subtotal * value) / 100;
    if (type === DiscountType.FIXED_AMOUNT) return Math.min(subtotal, value);
    return 0; // FREE_SHIPPING handled at checkout
  }

  private mapToDto(promotion: {
    id: string;
    code: string | null;
    type: DiscountType;
    value: Prisma.Decimal;
    minOrderAmount: Prisma.Decimal | null;
    maxUses: number | null;
    maxUsesPerUser: number;
    currentUses: number;
    isActive: boolean;
    startsAt: Date | null;
    expiresAt: Date | null;
    description: string | null;
    createdAt: Date;
    store?: { id: string; name: string; slug: string } | null;
    autoApply: boolean;
    scope: PromotionScope;
    country: string | null;
    termsAndConditions: string | null;
    products?: { productId: string }[];
  }): PromotionResponseDto {
    return {
      id: promotion.id,
      code: promotion.code,
      type: promotion.type,
      value: Number(promotion.value),
      minOrderAmount:
        promotion.minOrderAmount !== null
          ? Number(promotion.minOrderAmount)
          : null,
      maxUses: promotion.maxUses,
      maxUsesPerUser: promotion.maxUsesPerUser,
      currentUses: promotion.currentUses,
      isActive: promotion.isActive,
      startsAt: promotion.startsAt,
      expiresAt: promotion.expiresAt,
      description: promotion.description,
      createdAt: promotion.createdAt,
      store: promotion.store ?? null,
      autoApply: promotion.autoApply,
      scope: promotion.scope,
      country: promotion.country,
      termsAndConditions: promotion.termsAndConditions,
      productIds: promotion.products?.map((p) => p.productId),
    };
  }
}
