import { DiscountType } from '@prisma/client';

export class PromotionResponseDto {
  id!: string;
  code!: string;
  type!: DiscountType;
  value!: number;
  minOrderAmount?: number | null;
  maxUses?: number | null;
  maxUsesPerUser!: number;
  currentUses!: number;
  isActive!: boolean;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  description?: string | null;
  createdAt!: Date;
  /** Null = a platform-wide coupon, valid across every store. */
  store?: { id: string; name: string; slug: string } | null;
}

export class CouponValidationResultDto {
  valid!: boolean;
  code!: string;
  type!: DiscountType;
  value!: number;
  discountAmount!: number;
  description?: string | null;
}

export class PromotionStatsDto {
  promotionId!: string;
  code!: string;
  currentUses!: number;
  maxUses?: number | null;
  totalRevenueSaved!: number;
  recentUsages!: {
    orderId: string;
    usedAt: Date;
    userId?: string | null;
  }[];
}
