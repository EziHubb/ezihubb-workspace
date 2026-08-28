import { DiscountType, PromotionScope } from '@prisma/client';

export class PromotionResponseDto {
  id!: string;
  /** Null only for an autoApply sale — a buyer-code coupon always has one. */
  code!: string | null;
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

  autoApply!: boolean;
  scope!: PromotionScope;
  country?: string | null;
  termsAndConditions?: string | null;
  productIds?: string[];
  /** Paid item revenue attributed to this auto-apply sale in the last 30 days. */
  revenue?: number;
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
  totalUsed!: number;
  totalDiscount!: number;
  avgOrderSize!: number;
  topUserEmail?: string;
  topUserUses?: number;
  dailyUsage!: { date: string; count: number }[];
  recentUsages!: {
    id: string;
    customerName: string;
    customerEmail: string;
    orderId: string;
    orderNumber: string;
    discountAmount: number;
    usedAt: Date;
  }[];
}
