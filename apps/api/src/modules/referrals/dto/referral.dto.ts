import { IsString, IsIn, IsOptional, IsNumber, Min, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferralCommissionStatus, ReferralPayoutStatus } from '@prisma/client';

export class ReferralRequestPayoutDto {
  @ApiProperty({ example: 'paypal' })
  @IsString()
  @IsIn(['paypal', 'bank_transfer'])
  paymentMethod: string;

  @ApiProperty({ example: 'john@paypal.com' })
  @IsString()
  paymentDetail: string;

  @ApiProperty({ example: 45.2 })
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class ReferralCommissionDto {
  id: string;
  level: number;
  rate: number;
  baseAmount: number;
  amount: number;
  status: ReferralCommissionStatus;
  confirmedAt: Date | null;
  createdAt: Date;
  buyer: { firstName: string | null; lastName: string | null } | null;
  orderNumber: string;
}

export class ReferralMeDto {
  referralCode: string;
  referralBalance: number;
  referralEarned: number;
  totalReferrals: number;
  referralDepth: number;
  tier: {
    id: string;
    name: string;
    badgeColor: string;
    badgeIcon: string;
    commissionBonus: number;
    minReferrals: number;
    minEarned: number;
    sortOrder: number;
  } | null;
  nextTier: {
    id: string;
    name: string;
    minReferrals: number;
    minEarned: number;
    sortOrder: number;
  } | null;
  settings: {
    level1Rate: number;
    level2Rate: number;
    level3Rate: number;
    buyerDiscountRate: number;
    buyerDiscountEnabled: boolean;
    minPayoutAmount: number;
    lockDays: number;
    isEnabled: boolean;
  };
}

export class ReferralResolveDto {
  discountRate: number;
  referrerFirstName: string;
}

// Admin DTOs
export class AdminBalanceAdjustDto {
  @ApiProperty()
  @IsNumber()
  delta: number;

  @ApiProperty()
  @IsString()
  reason: string;
}

export class AdminTierOverrideDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tierId: string | null;
}

export class AdminPayoutRejectDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class AdminReferralSettingsDto {
  @IsNumber() @Min(0) level1Rate: number;
  @IsNumber() @Min(0) level2Rate: number;
  @IsNumber() @Min(0) level3Rate: number;
  @IsNumber() @Min(0) buyerDiscountRate: number;
  buyerDiscountEnabled: boolean;
  @IsNumber() @Min(0) minPayoutAmount: number;
  @IsNumber() @Min(1) lockDays: number;
  isEnabled: boolean;
}

export class AdminTierDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsNumber() @Min(0) minReferrals: number;
  @ApiProperty() @IsNumber() @Min(0) minEarned: number;
  @ApiProperty() @IsNumber() @Min(0) commissionBonus: number;
  @ApiProperty() @IsString() badgeColor: string;
  @ApiProperty() @IsString() badgeIcon: string;
  @ApiProperty() @IsNumber() sortOrder: number;
}
