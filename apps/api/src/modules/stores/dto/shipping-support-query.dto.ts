import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const SHIPPING_SUPPORT_PERIODS = [7, 30, 90, 365] as const;

export enum ShippingSupportStatus {
  ALL = 'all',
  PENDING = 'pending',
  REALIZED = 'realized',
}

export enum ShippingSupportSort {
  NEWEST = 'newest',
  SUBSIDY = 'subsidy',
  ORDER_VALUE = 'order-value',
}

export class ShippingSupportSummaryQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @IsIn(SHIPPING_SUPPORT_PERIODS)
  days = 30;
}

export class ShippingSupportOrdersQueryDto extends ShippingSupportSummaryQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  storeId?: string;

  @IsOptional()
  @IsEnum(ShippingSupportStatus)
  status = ShippingSupportStatus.ALL;

  @IsOptional()
  @IsEnum(ShippingSupportSort)
  sort = ShippingSupportSort.NEWEST;
}
