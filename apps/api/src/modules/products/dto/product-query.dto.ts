import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsEnum,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ProductStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export enum ProductSortBy {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  BESTSELLER = 'bestseller',
  RATING = 'rating',
  FEATURED = 'featured',
}

export class ProductQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by product name (ILIKE)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Collection slug' })
  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional({ description: 'Tag slugs (comma-separated or repeated)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [],
  )
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  minRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  /**
   * Listings the buyer can personalise. Backs the storefront's
   * "personalisable ideas" strip, which was sending this parameter already —
   * the DTO did not declare it, so ValidationPipe's forbidNonWhitelisted
   * rejected every one of those requests with a 400 and the strip silently
   * rendered nothing.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPersonalizable?: boolean;

  /**
   * Collection slug. The collection page has always sent this; the DTO never
   * declared it, so every one of those requests was rejected with a 400 and
   * each collection rendered as empty.
   *
   * Slug rather than id, matching `category` — the URL already carries the
   * slug, so resolving it here keeps ids out of the address bar.
   */
  @ApiPropertyOptional({ description: 'Filter to products in this collection' })
  @IsOptional()
  @IsString()
  collectionSlug?: string;

  /**
   * Fetch an explicit set of products by id. Used by the storefront's
   * "Featured items" strip to render exactly the listings a seller pinned in
   * Shop Home (`Store.featuredProductIds`) instead of whatever carries the
   * `isFeatured` flag. Capped so this can't be turned into a bulk-scrape
   * parameter on a public endpoint.
   *
   * NOTE: result ORDER is not guaranteed here — Prisma returns rows in
   * whatever order the sort/index gives. The caller re-orders to match the
   * ids it asked for (see StoreProductsClient), because the seller's chosen
   * sequence is the whole point of the picker.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  ids?: string[];

  @ApiPropertyOptional({ enum: ProductSortBy, default: ProductSortBy.NEWEST })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sort?: ProductSortBy;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  // Admin-only: include inactive products
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by store ID' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Filter by store slug' })
  @IsOptional()
  @IsString()
  storeSlug?: string;

  @ApiPropertyOptional({ description: 'Filter by shop section ID' })
  @IsOptional()
  @IsString()
  shopSectionId?: string;
}
