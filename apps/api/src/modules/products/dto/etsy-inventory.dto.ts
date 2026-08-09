import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// Mirrors Etsy Open API v3's real Listing Inventory shape
// (GET /v3/application/listings/{listing_id}/inventory) — NOT the
// property/value price-range summary Etsy's own listing page UI uses to hint
// "$34–$47" in a color dropdown before a full combination is picked. That
// summary form only carries a min/max per single property value and cannot
// be reconstructed into a real per-combination price list (verified: two
// options can share the same base price yet have different max prices,
// meaning the full price matrix has per-combination variation the min/max
// pair alone doesn't capture). This DTO accepts the actual inventory
// endpoint's response — one row per real product/SKU, each with its own
// concrete price — the same flat-combination shape CreateVariantDto already
// expects internally.

export class EtsyMoneyDto {
  @ApiProperty({ example: 3417, description: 'Integer amount before dividing by `divisor`' })
  @IsInt()
  amount!: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  divisor!: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency_code?: string;
}

export class EtsyPropertyValueDto {
  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  property_id?: number;

  @ApiPropertyOptional({ example: 'Size' })
  @IsOptional()
  @IsString()
  property_name?: string;

  @ApiProperty({ example: ['Blonde'], description: 'The value(s) for this property on this product row — normally a single-element array' })
  @IsArray()
  @IsString({ each: true })
  values!: string[];
}

export class EtsyOfferingDto {
  @ApiProperty({ type: EtsyMoneyDto })
  @ValidateNested()
  @Type(() => EtsyMoneyDto)
  price!: EtsyMoneyDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  quantity?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}

export class EtsyInventoryProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ type: [EtsyPropertyValueDto], description: 'One entry per variation axis (e.g. Color, Size) for this specific combination' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EtsyPropertyValueDto)
  property_values!: EtsyPropertyValueDto[];

  @ApiProperty({ type: [EtsyOfferingDto], description: "Etsy allows multiple offerings per product; this platform uses the first enabled one" })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EtsyOfferingDto)
  offerings!: EtsyOfferingDto[];
}

export class EtsyInventoryDto {
  @ApiProperty({ type: [EtsyInventoryProductDto], description: 'Flat list — one entry per real SKU/combination, each with its own price. This is Etsy\'s actual inventory data, not the property-level price-range summary shown in Etsy\'s own variation dropdowns.' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EtsyInventoryProductDto)
  products!: EtsyInventoryProductDto[];

  // Informational only (which property Etsy's own seller-dashboard UI treats
  // as "driving" price/quantity/sku) — not needed for mapping since `products`
  // is already the complete flat combination list regardless of these hints.
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  price_on_property?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  quantity_on_property?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  sku_on_property?: number[];
}
