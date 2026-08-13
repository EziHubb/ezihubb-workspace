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
  minPayoutAmount?: number;

  @IsString()
  @IsOptional()
  payoutSchedule?: string;

  @IsBoolean()
  @IsOptional()
  allowPublicRegistration?: boolean;

  @IsBoolean()
  @IsOptional()
  maintenanceMode?: boolean;
}
