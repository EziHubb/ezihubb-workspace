import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DiscountType, PromotionScope } from '@prisma/client';

export class CreatePromotionDto {
  @ApiPropertyOptional({ example: 'SUMMER20', description: 'Required unless autoApply is true (a storewide sale has no buyer-entered code)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({
    example: 20,
    description: 'Percentage (0–100) or fixed amount in cents/dollars',
  })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Minimum order total required',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum total uses; null = unlimited' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startsAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Only honored for a platform-context SUPER_ADMIN (no store switched into) — targets a specific store instead of creating a platform-wide coupon. Ignored for any other caller, who always creates under their own store.' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ default: false, description: 'Storewide sale — silently applied at the best-price calculation, no buyer code entry.' })
  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;

  @ApiPropertyOptional({ enum: PromotionScope, default: PromotionScope.SHOP_WIDE })
  @IsOptional()
  @IsEnum(PromotionScope)
  scope?: PromotionScope;

  @ApiPropertyOptional({ description: 'Product IDs this sale applies to — required when scope is SPECIFIC_LISTINGS.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code — null/omitted means "Everywhere".' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ description: 'Buyer-facing terms shown on eligible listings during the sale.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  termsAndConditions?: string;
}

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}

/**
 * What PATCH accepts: every updatable field, plus the active toggle.
 *
 * A real class, and that is the whole point. The route used to be typed
 * `UpdatePromotionDto & { isActive?: boolean }`, and an intersection is a
 * TypeScript type with no runtime identity — `design:paramtypes` emits
 * `Object`, so ValidationPipe saw a plain object, decided there was nothing to
 * validate, and skipped BOTH validation and transformation for the entire
 * endpoint.
 *
 * The visible symptom was a 500 on saving a sale: `@Type(() => Date)` never
 * ran, so the date-only string the admin sends reached Prisma untouched and it
 * refused a value that was not a full ISO-8601 DateTime. The invisible half was
 * worse — nothing else on this route was being checked either.
 */
export class PatchPromotionDto extends UpdatePromotionDto {
  @ApiPropertyOptional({ description: 'Pause or resume the promotion' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
