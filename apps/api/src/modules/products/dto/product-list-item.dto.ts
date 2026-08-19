import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() sku: string;
  @ApiProperty() basePrice: number;
  @ApiPropertyOptional() compareAtPrice: number | null;
  /** Lowest/highest ProductVariant.price for this product, or null if it has no variants.
   *  basePrice is seller-entered and never auto-synced to variant prices — cards should
   *  prefer minPrice (falling back to basePrice) so a stale basePrice can't mislead buyers. */
  @ApiPropertyOptional() minPrice: number | null;
  @ApiPropertyOptional() maxPrice: number | null;
  @ApiPropertyOptional() primaryImageUrl: string | null;
  @ApiPropertyOptional() primaryImage: string | null;
  @ApiProperty() images: { url: string; isPrimary?: boolean }[];
  @ApiProperty() categoryId: string;
  @ApiProperty() categoryName: string;
  @ApiProperty() categorySlug: string;
  /**
   * Colour tags for the swatch strip on a listing card. Costs no extra query:
   * both mappers fetch products with Prisma `include`, which already returns
   * every scalar column — this only maps a value that was being discarded.
   *
   * Mapped in TWO places (ProductsService.toListItems and
   * SearchService.toListItems). Both must stay in sync or the swatches appear
   * on some listing surfaces and silently vanish on others.
   */
  @ApiProperty({ type: [String] }) primaryColors: string[];
  /**
   * PHYSICAL | DIGITAL. Backs the "digital download" marker on a listing
   * card. libs/shared/types has declared this on the client type for a while
   * without the API ever sending it, so it was a field that type-checked and
   * was always undefined at runtime.
   * Mapped in the same THREE places as primaryColors.
   */
  @ApiProperty() productType: string;
  @ApiProperty() isPersonalizable: boolean;
  @ApiProperty() isFeatured: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() status: string;
  @ApiPropertyOptional() quantity: number | null;
  @ApiProperty() viewCount: number;
  @ApiProperty() soldCount: number;
  @ApiPropertyOptional() averageRating: number | null;
  @ApiProperty() reviewCount: number;
  /** Badge: orders confirmed in last 24 hours */
  @ApiProperty() inDemandCount: number;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional() storeId?: string | null;
  @ApiPropertyOptional() storeName?: string | null;
  @ApiPropertyOptional() storeSlug?: string | null;
  @ApiPropertyOptional() store?: { id: string; name: string; slug: string } | null;
}
