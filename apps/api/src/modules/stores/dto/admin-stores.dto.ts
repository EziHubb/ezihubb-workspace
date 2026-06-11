import {
  IsString, IsOptional, IsNumber, IsBoolean, IsEnum,
  Min, Max, MaxLength, IsArray, IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StoreStatus, StorePlanType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ApproveStoreDto {
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  @Max(0.5)
  commissionRate?: number;

  @IsString()
  @IsOptional()
  planId?: string;

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

export class AssignPlanDto {
  @IsString()
  planId: string;
}

export class AdminListStoresDto extends PaginationDto {
  @IsEnum(StoreStatus)
  @IsOptional()
  status?: StoreStatus;

  @IsString()
  @IsOptional()
  search?: string;
}

export class CreateSellerPlanDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  monthlyPrice: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxProducts?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate: number;

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateSellerPlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  monthlyPrice?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxProducts?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  features?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdatePlatformSettingsDto {
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  @Max(0.5)
  defaultCommissionRate?: number;

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
