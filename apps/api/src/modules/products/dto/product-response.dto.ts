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

/**
 * One product video and the metadata derived from it at upload.
 *
 * `thumbnailUrls` is a LIST of stored objects, not a set of transform URLs
 * built from one asset. Media CDNs derive every size on request from a single
 * upload; our storage has no transform layer, so each entry here is a real
 * file that upload generated and delete has to clean up. Order is by intent:
 * full-size gallery poster first, square card poster second.
 *
 * It can be EMPTY. Clips that predate poster extraction, and clips whose
 * first frames would not decode, have no poster — an empty list is the honest
 * answer, and callers should fall back to the product image rather than
 * assume index 0 exists.
 *
 * `duration` is ISO 8601 (`PT10S`) to match schema.org/VideoObject, so it can
 * be dropped straight into video markup. Null when never measured.
 */
export class ProductVideoDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiProperty({ type: [String] }) thumbnailUrls: string[];
  @ApiPropertyOptional({ example: 'PT10S' }) duration: string | null;
  @ApiProperty() uploadedAt: string;
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

export class VariationPhotosDto {
  /** Matches one `variantOptions[].name`, i.e. the dropdown that drives the gallery. */
  @ApiProperty() groupName: string;
  /**
   * Option name → ProductImage.id. Only options the seller actually assigned a
   * photo to appear here, so a lookup miss means "leave the gallery alone"
   * rather than "show nothing".
   */
  @ApiProperty({ type: Object, additionalProperties: { type: 'string' } })
  imageIdByValue: Record<string, string>;
}

export class BundlePartnerProductDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() price: number;
  @ApiProperty({ type: [String] }) images: string[];
}

export class ProductBundleOfferDto {
  @ApiProperty() id: string;
  @ApiProperty() discountPercent: number;
  @ApiProperty({ type: [BundlePartnerProductDto] }) products: BundlePartnerProductDto[];
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
  /**
   * Etsy "Set up a sale" — the active auto-apply discount's own terms (not a
   * pre-computed price), so the storefront can apply it to whichever price is
   * currently selected (base or a specific variant) rather than only
   * `basePrice`. Null when no sale is active. Checkout always recomputes this
   * itself server-side — never trust a client-displayed price.
   */
  @ApiPropertyOptional() salePromo?: { type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number } | null;
  /** Active "Buy them together" bundle this listing belongs to, if any. */
  @ApiPropertyOptional({ type: () => ProductBundleOfferDto }) bundleOffer?: ProductBundleOfferDto | null;
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
  /**
   * The one variation whose options are tied to listing photos, if the seller
   * set one up — so picking an option can bring its photo forward in the
   * gallery. Null when nothing is linked, which is the common case.
   *
   * Deliberately not the whole VariationGroup tree: this carries only what the
   * gallery needs, keyed the same way `variantOptions` is (group name → option
   * name), so no new identifier scheme leaks into the public payload.
   */
  @ApiPropertyOptional({ type: () => VariationPhotosDto, nullable: true })
  variationPhotos?: VariationPhotosDto | null;
  @ApiProperty({ type: [ProductImageResponseDto] }) images: ProductImageResponseDto[];
  @ApiPropertyOptional({ type: [DigitalFileResponseDto] }) digitalFiles?: DigitalFileResponseDto[];
  @ApiProperty({ type: [ProductVideoDto] }) videos: ProductVideoDto[];
  /** @deprecated Superseded by `videos`, which carries posters and duration. Still returned so existing integrations keep working. */
  @ApiPropertyOptional({ type: [String], deprecated: true }) videoUrls?: string[];
  @ApiProperty({ type: [ProductTagResponseDto] }) tags: ProductTagResponseDto[];
  @ApiPropertyOptional() customizationConfig: Record<string, unknown> | null;
  @ApiPropertyOptional() averageRating: number | null;
  @ApiProperty() reviewCount: number;
  @ApiProperty() inDemandCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
