import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VariantResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() options: Record<string, string>;
  @ApiProperty() price: number;
  @ApiPropertyOptional() sku: string | null;
  @ApiProperty() isDefault: boolean;
  @ApiProperty() sortOrder: number;
}

export class ProductImageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiPropertyOptional() altText: string | null;
  @ApiProperty() isPrimary: boolean;
  @ApiProperty() sortOrder: number;
}

export class ProductTagResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
}

export class ProductCategoryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
}

export class ProductResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() sku: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional() shortDescription: string | null;
  @ApiProperty() basePrice: number;
  @ApiPropertyOptional() compareAtPrice: number | null;
  @ApiProperty() isPersonalizable: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isFeatured: boolean;
  @ApiProperty() viewCount: number;
  @ApiProperty() soldCount: number;
  @ApiProperty() processingDays: number;
  @ApiProperty({ type: () => ProductCategoryDto }) category: ProductCategoryDto;
  @ApiProperty({ type: [VariantResponseDto] }) variants: VariantResponseDto[];
  @ApiProperty({ type: [ProductImageResponseDto] }) images: ProductImageResponseDto[];
  @ApiProperty({ type: [ProductTagResponseDto] }) tags: ProductTagResponseDto[];
  @ApiPropertyOptional() customizationConfig: Record<string, unknown> | null;
  @ApiPropertyOptional() averageRating: number | null;
  @ApiProperty() reviewCount: number;
  @ApiProperty() inDemandCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
