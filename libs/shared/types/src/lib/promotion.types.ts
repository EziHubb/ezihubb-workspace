export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

export interface PromotionDto {
  id:               string;
  code:             string;
  type:             DiscountType;
  value:            number;
  description?:     string;
  minOrderAmount?:  number;
  maxUses?:         number;
  maxUsesPerUser?:  number;
  currentUses:      number;
  startsAt?:        string;
  expiresAt?:       string;
  isActive:         boolean;
  createdAt:        string;
  updatedAt:        string;
}

export interface CouponValidationResultDto {
  valid:          boolean;
  code:           string;
  type:           DiscountType;
  value:          number;
  discountAmount: number;
  message?:       string;
}
