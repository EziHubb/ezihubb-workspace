import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddCartItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Personalization fields (stored as JSON snapshot)' })
  @IsOptional()
  customizationData?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Preview image URL generated from customization' })
  @IsOptional()
  @IsString()
  previewUrl?: string;
}
