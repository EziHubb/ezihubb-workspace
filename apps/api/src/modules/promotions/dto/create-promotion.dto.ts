import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreatePromotionDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @MinLength(1)
  code!: string;

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
}

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}
