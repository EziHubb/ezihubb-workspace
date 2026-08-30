import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  IsObject,
  IsPositive,
  ValidateNested,
  IsNotEmpty,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Sub-DTOs ──────────────────────────────────────────────────────────────────

export class AttributeDto {
  @ApiProperty({ example: 'Material' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'Bamboo' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ default: false, description: 'Show this attribute in the filter sidebar' })
  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @ApiPropertyOptional({ example: 'oz', description: 'Unit label (oz, cm, inches…)' })
  @IsOptional()
  @IsString()
  unit?: string;
}

export class VariantOptionDto {
  @ApiProperty({ example: 'Size' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: [String], example: ['11oz', '15oz', '20oz'] })
  @IsArray()
  @IsString({ each: true })
  values: string[];
}

export class VariantDto {
  @ApiProperty({ example: 'MUG-001-11OZ-WHT' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: { Size: '11oz', Color: 'White' } })
  @IsObject()
  options: Record<string, string>;

  @ApiProperty({ example: 27.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 35.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  compareAtPrice?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Index of product image to show when this variant is selected' })
  @IsOptional()
  @IsNumber()
  imageIndex?: number;
}

export class CustomizerFieldDto {
  @ApiProperty({ example: 'name_text' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ enum: ['text', 'textarea', 'image', 'select', 'color'] })
  @IsEnum(['text', 'textarea', 'image', 'select', 'color'])
  type: string;

  @ApiProperty({ example: 'Your Name' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsNumber()
  maxLength?: number;

  @ApiPropertyOptional({ type: [String], description: 'Options for select fields' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CustomizationTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ type: [CustomizerFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomizerFieldDto)
  fields: CustomizerFieldDto[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  previewLayers: object[];
}

export class GpsrInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturerAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  manufacturerEmail?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  safetyWarnings?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryOfOrigin?: string;
}

// ── Root DTO ──────────────────────────────────────────────────────────────────

export class CreateProductDetailDto {
  /**
   * Links to PostgreSQL Product.id — supplied by the URL, not the body.
   *
   * Optional, and it matters. It used to be required, but the only endpoint
   * that takes this DTO is PUT /admin/products/:id/detail, whose service
   * queries Mongo by the `productId` PARAMETER and never reads this field at
   * all. The controller's `dto.productId = id` could not help either: the
   * global ValidationPipe validates the body before the handler runs, so a
   * body without it was rejected with "productId should not be empty" before
   * that line was ever reached.
   *
   * The product editor's save path did not send it, so every edit to an
   * existing listing failed validation; the create path happened to send it
   * and worked, which is why this only ever broke editing.
   */
  @ApiPropertyOptional({ description: 'Ignored — the URL parameter is authoritative' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Rich HTML product description' })
  @IsOptional()
  @IsString()
  richDescription?: string;

  @ApiPropertyOptional({ description: 'Size guide (markdown / HTML)' })
  @IsOptional()
  @IsString()
  sizeGuide?: string;

  @ApiPropertyOptional({ description: 'Per-product shipping note (overrides global)' })
  @IsOptional()
  @IsString()
  shippingNote?: string;

  @ApiPropertyOptional({ type: [AttributeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeDto)
  attributes?: AttributeDto[];

  @ApiPropertyOptional({ type: [VariantOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  variantOptions?: VariantOptionDto[];

  @ApiPropertyOptional({ type: [VariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomizationTemplateDto)
  customization?: CustomizationTemplateDto;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  imageAltTexts?: Record<string, string>;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  customOptions?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GpsrInfoDto)
  gpsrInfo?: GpsrInfoDto | null;
}

// ── Attribute-only update ─────────────────────────────────────────────────────

export class SetAttributesDto {
  @ApiProperty({ type: [AttributeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeDto)
  attributes: AttributeDto[];
}
