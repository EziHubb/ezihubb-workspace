import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// Etsy's own listing-page price-range hint format — the only shape a partner
// integration can realistically obtain without the listing owner's Etsy
// OAuth credentials (the real combined per-SKU inventory requires that,
// so this is the sole supported variant-import shape). Each option only
// carries a min/max price observed across all combinations that include it,
// not the price of any
// specific combination. This is a lossy projection of the real price matrix:
// verified on real data that two option values can share the identical base
// `price` yet have different `price_max`, which is only possible if some
// combinations were priced individually rather than by a formula — so exact
// per-combination prices CANNOT be derived from this shape. Accepted anyway
// (per explicit product decision) as a best-effort import — the product goes
// live immediately like any other create call, so sellers/admins should
// spot-check generated variant prices afterward when more than one property
// affects price (see EtsyVariationSummaryResult.priceEstimated).

export class EtsyVariationOptionDto {
  @ApiPropertyOptional({ example: '6954580708' })
  @IsOptional()
  @IsString()
  value_id?: string;

  @ApiProperty({ example: 'Blonde' })
  @IsString()
  value!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({ description: 'Usually equal to price_min — the cheapest combination price observed for this option.' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ description: 'Cheapest total price across all combinations that include this option.' })
  @IsNumber()
  price_min!: number;

  @ApiProperty({ description: 'Most expensive total price across all combinations that include this option.' })
  @IsNumber()
  price_max!: number;
}

export class EtsyVariationPropertyDto {
  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsString()
  property_id?: string;

  @ApiProperty({ example: 'Colors' })
  @IsString()
  name!: string;

  @ApiProperty({ type: [EtsyVariationOptionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EtsyVariationOptionDto)
  options!: EtsyVariationOptionDto[];
}
