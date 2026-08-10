import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductImageType, PrintSide, ProductType } from '@prisma/client';

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
  @ApiProperty({ enum: ProductImageType }) type: ProductImageType;
  @ApiPropertyOptional({ enum: PrintSide }) printSide: PrintSide | null;
}

// Deliberately no storageKey/URL — the raw deliverable is never exposed to
// any client, only fetched server-side by the download endpoint.
export class DigitalFileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() filename: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty() sortOrder: number;
  @ApiPropertyOptional() variantId: string | null;
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

export class ProductStoreDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
}

export class VariantOptionDto {
  @ApiProperty() name: string;
  @ApiProperty({ type: [String] }) values: string[];
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
  @ApiProperty({ enum: ProductType }) productType: ProductType;
  @ApiProperty() isFeatured: boolean;
  @ApiProperty() viewCount: number;
  @ApiProperty() soldCount: number;
  @ApiProperty() processingDays: number;
  @ApiProperty({ type: () => ProductCategoryDto }) category: ProductCategoryDto;
  @ApiPropertyOptional({ type: () => ProductStoreDto }) store: ProductStoreDto | null;
  @ApiProperty({ type: [VariantResponseDto] }) variants: VariantResponseDto[];
  @ApiProperty({ type: [VariantOptionDto] }) variantOptions: VariantOptionDto[];
  @ApiProperty({ type: [ProductImageResponseDto] }) images: ProductImageResponseDto[];
  @ApiPropertyOptional({ type: [DigitalFileResponseDto] }) digitalFiles?: DigitalFileResponseDto[];
  @ApiPropertyOptional({ type: [String] }) videoUrls?: string[];
  @ApiProperty({ type: [ProductTagResponseDto] }) tags: ProductTagResponseDto[];
  @ApiPropertyOptional() customizationConfig: Record<string, unknown> | null;
  @ApiPropertyOptional() averageRating: number | null;
  @ApiProperty() reviewCount: number;
  @ApiProperty() inDemandCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
