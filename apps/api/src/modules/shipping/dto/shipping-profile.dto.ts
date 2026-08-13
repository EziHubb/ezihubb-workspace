import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ShippingChargeType } from '@prisma/client';
import { CARRIER_SERVICE_VALUES } from '@ezihubb/constants';

export class ShippingProfileMethodDto {
  @ApiProperty({ example: 'domestic', description: '"domestic" | "everywhere_else" | ISO 3166-1 alpha-2 country code' })
  @IsString()
  destinationType!: string;

  @ApiProperty({ enum: CARRIER_SERVICE_VALUES, example: 'GHN' })
  @IsIn(CARRIER_SERVICE_VALUES)
  carrierService!: string;

  @ApiPropertyOptional({ description: 'Free-text carrier label — only meaningful when carrierService = "OTHER"' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  carrierName?: string;

  @ApiProperty({ enum: ShippingChargeType, example: ShippingChargeType.FIXED })
  @IsEnum(ShippingChargeType)
  chargeType!: ShippingChargeType;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(180)
  minDays!: number;

  @ApiProperty({ example: 8 })
  @IsInt()
  @Min(0)
  @Max(180)
  maxDays!: number;

  @ApiPropertyOptional({ description: 'Required when chargeType = FIXED, ignored when FREE' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Surcharge per additional item in the same order — FIXED only' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraItemPrice?: number;
}

export class ShippingProfileDto {
  @ApiProperty({ example: 'Standard Shipping' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'VN', description: 'ISO 3166-1 alpha-2 — country items are dispatched from' })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  originCountry!: string;

  @ApiProperty({ example: '700000' })
  @IsString()
  @MaxLength(20)
  originPostalCode!: string;

  @ApiProperty({ type: [ShippingProfileMethodDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShippingProfileMethodDto)
  methods!: ShippingProfileMethodDto[];
}
