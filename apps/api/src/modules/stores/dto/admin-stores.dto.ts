import {
  IsString, IsOptional, IsNumber, IsBoolean, IsEnum,
  Min, Max, MaxLength, IsArray,
} from 'class-validator';
import { StoreStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ApproveStoreDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  adminNote?: string;
}

export class RejectStoreDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class SuspendStoreDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class AdminListStoresDto extends PaginationDto {
  @IsEnum(StoreStatus)
  @IsOptional()
  status?: StoreStatus;

  @IsString()
  @IsOptional()
  search?: string;
}

export class UpdatePlatformSettingsDto {
  // ── Seller fees (Etsy-style — platform-wide, not negotiable per seller) ───
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(0.5)
  transactionFeeRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(0.5)
  paymentProcessingFeeRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  paymentProcessingFixedFee?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  listingFee?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(0.5)
  regulatoryFeeRate?: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  regulatoryFeeCountries?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(0.5)
  vatOnFeesRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(0.5)
  offsiteAdsFeeRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minPayoutAmount?: number;

  @IsString()
  @IsOptional()
  payoutSchedule?: string;

  // Was missing from this DTO, so `whitelist: true` silently dropped it and
  // the platform name could never actually be changed — same silent-swallow
  // class as plusMonthlyPrice/offsiteAdsFeeRate. Follows the `payoutSchedule`
  // pattern above exactly (no @MaxLength: no string field in this DTO caps
  // length, and the DB column is an uncapped String).
  @IsString()
  @IsOptional()
  platformName?: string;

  @IsBoolean()
  @IsOptional()
  allowPublicRegistration?: boolean;

  @IsBoolean()
  @IsOptional()
  maintenanceMode?: boolean;

  /** Platform-wide order threshold for free standard shipping. Zero disables it. */
  @IsNumber()
  @IsOptional()
  @Min(0)
  freeShippingThreshold?: number;

  // ── Ezihubb Plus pricing (list price — mirrors PlatformSettings.plusMonthlyPrice
  // / plusAnnualPrice; see StoreSubscription.priceAtPurchase for the per-store
  // snapshot taken at grant time, which this does NOT retroactively change) ───
  // Same bare `@Min(0)` pattern as the other currency fields above
  // (paymentProcessingFixedFee, listingFee, minPayoutAmount) — none of them
  // enforce a decimal-places cap either, so adding one here only for these
  // two fields would be inconsistent rather than safer.
  @IsNumber()
  @IsOptional()
  @Min(0)
  plusMonthlyPrice?: number;

  // `@IsOptional()` treats an explicit `null` the same as "omitted" (skips
  // the @IsNumber/@Min checks) — this is what lets an admin PATCH
  // `{ plusAnnualPrice: null }` to deliberately clear the annual price back
  // to "not configured" (grant() then rejects ANNUAL again), while omitting
  // the field entirely leaves the existing value untouched.
  @IsNumber()
  @IsOptional()
  @Min(0)
  plusAnnualPrice?: number | null;
}
