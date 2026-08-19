import { PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsInt, IsArray,
         IsEnum, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
// ProductStatus was removed from schema — no enum needed
import { CreateProductDto } from './create-product.dto';

// ── Base: all CreateProductDto fields optional (minus variants) ───────────────

class BaseUpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variants'] as const),
) {}

// ── Extended: new schema fields from EDIT-00 ─────────────────────────────────

export class UpdateProductDto extends BaseUpdateProductDto {
  // ── Attribute arrays ──────────────────────────────────────────────────────
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  primaryColors?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  secondaryColors?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  materials?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  occasions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  holidayTags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  recipientTags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  styles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  sustainability?: string[];

  @ApiPropertyOptional({ description: 'Buyer-facing physical width — not shipping-package dimensions' })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  width?: number | null;

  @ApiPropertyOptional({ description: 'Buyer-facing physical height — not shipping-package dimensions' })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  height?: number | null;

  @ApiPropertyOptional({ enum: ['CM','IN','MM','M'] })
  @IsOptional() @IsEnum(['CM','IN','MM','M'])
  dimensionUnit?: 'CM' | 'IN' | 'MM' | 'M' | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  videoUrls?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  toolsUsed?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  productionPartnerIds?: string[];

  // ── Scalar new fields ──────────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  domesticGlobalPricing?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  quantity?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  lowStockThreshold?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isAdsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(64)
  hsCode?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  titleCharCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  thumbnailCropData?: Record<string, number> | null;

  // ── Enum fields ────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: ['NO_RETURNS','RETURNS_ACCEPTED','EXCHANGES_ONLY'] })
  @IsOptional() @IsEnum(['NO_RETURNS','RETURNS_ACCEPTED','EXCHANGES_ONLY'])
  returnPolicy?: 'NO_RETURNS' | 'RETURNS_ACCEPTED' | 'EXCHANGES_ONLY';

  @ApiPropertyOptional({ enum: ['I_DID','SHOP_MEMBER','ANOTHER_COMPANY'] })
  @IsOptional() @IsEnum(['I_DID','SHOP_MEMBER','ANOTHER_COMPANY'])
  whoMadeIt?: 'I_DID' | 'SHOP_MEMBER' | 'ANOTHER_COMPANY';

  @ApiPropertyOptional({ enum: ['MADE_TO_ORDER','HANDMADE','ASSEMBLED','ALTERED','CURATED_SET','NATURAL_MATERIAL'] })
  @IsOptional() @IsEnum(['MADE_TO_ORDER','HANDMADE','ASSEMBLED','ALTERED','CURATED_SET','NATURAL_MATERIAL'])
  howItWasMade?: 'MADE_TO_ORDER' | 'HANDMADE' | 'ASSEMBLED' | 'ALTERED' | 'CURATED_SET' | 'NATURAL_MATERIAL';

  @ApiPropertyOptional({ enum: ['RECENTLY_MADE','VINTAGE'] })
  @IsOptional() @IsEnum(['RECENTLY_MADE','VINTAGE'])
  whenMade?: 'RECENTLY_MADE' | 'VINTAGE';

  @ApiPropertyOptional({ description: 'Seller offers gift wrapping on this listing' })
  @IsOptional() @IsBoolean()
  giftWrappingAvailable?: boolean;

  @ApiPropertyOptional({ enum: ['AUTOMATIC','MANUAL'] })
  @IsOptional() @IsEnum(['AUTOMATIC','MANUAL'])
  renewalType?: 'AUTOMATIC' | 'MANUAL';

  // ── FK fields ──────────────────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  processingProfileId?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  shippingProfileId?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  shopSectionId?: string | null;

  // status field removed — use isActive boolean instead
}
