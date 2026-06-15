import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedResult,
  paginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
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
      code: promotion.code,
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

  async create(dto: CreatePromotionDto): Promise<PromotionResponseDto> {
    const code = dto.code.toUpperCase();
    const existing = await this.prisma.promotion.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ERR_COUPON_CODE_TAKEN',
        message: 'Coupon code already exists',
      });
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
      },
    });

    return this.mapToDto(promotion);
  }

  async findAll(
    query: PaginationDto,
    storeId?: string,
  ): Promise<PaginatedResult<PromotionResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where = storeId !== undefined ? { storeId } : {};

    const [promotions, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return paginatedResponse(promotions.map(this.mapToDto), page, limit, total);
  }

  async findOne(id: string): Promise<PromotionResponseDto> {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promotion)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Promotion not found',
      });
    return this.mapToDto(promotion);
  }

  async update(
    id: string,
    dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    await this.findOne(id);

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
      },
    });

    return this.mapToDto(promotion);
  }

  async patch(
    id: string,
    dto: UpdatePromotionDto & { isActive?: boolean },
  ): Promise<PromotionResponseDto> {
    await this.findOne(id);

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
      },
    });

    return this.mapToDto(promotion);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.promotion.delete({ where: { id } });
  }

  async getPageStats(): Promise<{
    activeCoupons: number;
    usedToday: number;
    revenueDiscounted: number;
    avgDiscountValue: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeCoupons, usedToday, usages] = await Promise.all([
      this.prisma.promotion.count({ where: { isActive: true } }),
      this.prisma.promotionUsage.count({ where: { usedAt: { gte: todayStart } } }),
      this.prisma.promotionUsage.findMany({
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

  async deactivate(id: string): Promise<PromotionResponseDto> {
    await this.findOne(id);
    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });
    return this.mapToDto(promotion);
  }

  async getStats(id: string): Promise<PromotionStatsDto> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        usages: {
          orderBy: { usedAt: 'desc' },
          take: 20,
          include: {
            order: { select: { discountAmount: true } },
          },
        },
      },
    });
    if (!promotion)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Promotion not found',
      });

    const totalRevenueSaved = promotion.usages.reduce(
      (sum, u) => sum + Number(u.order.discountAmount),
      0,
    );

    return {
      promotionId: promotion.id,
      code: promotion.code,
      currentUses: promotion.currentUses,
      maxUses: promotion.maxUses,
      totalRevenueSaved,
      recentUsages: promotion.usages.map((u) => ({
        orderId: u.orderId,
        usedAt: u.usedAt,
        userId: u.userId,
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
    code: string;
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
    };
  }
}
