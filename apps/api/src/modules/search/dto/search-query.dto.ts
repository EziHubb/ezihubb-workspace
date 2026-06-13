import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsArray,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ProductSortBy } from '../../products/dto/product-query.dto';

export enum SearchSortBy {
  RELEVANCE  = 'relevance',
  NEWEST     = ProductSortBy.NEWEST,
  PRICE_ASC  = ProductSortBy.PRICE_ASC,
  PRICE_DESC = ProductSortBy.PRICE_DESC,
  BESTSELLER = ProductSortBy.BESTSELLER,
  RATING     = ProductSortBy.RATING,
  FEATURED   = ProductSortBy.FEATURED,
}

export enum ItemType {
  READY_TO_SHIP = 'ready_to_ship',
  TO_ORDER      = 'to_order',
  DIGITAL       = 'digital',
}

const toBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
};

export class SearchQueryDto extends PaginationDto {
  @ApiPropertyOptional({ default: 48, minimum: 1, maximum: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  override limit?: number = 48;

  @ApiPropertyOptional({ description: 'Full-text search keyword', example: 'custom mug' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (value as string)?.trim())
  q?: string;

  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Collection slug' })
  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional({ description: 'Tag slugs (comma-separated)' })
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

  @ApiPropertyOptional({ enum: ItemType, description: 'Item type: ready_to_ship | to_order | digital' })
  @IsOptional()
  @IsEnum(ItemType)
  itemType?: ItemType;

  @ApiPropertyOptional({ description: 'Filter to products with free shipping' })
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  freeShipping?: boolean;

  @ApiPropertyOptional({ description: 'Filter to on-sale products (has compare-at price)' })
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  onSale?: boolean;

  @ApiPropertyOptional({ description: 'Filter to star sellers (high sales volume)' })
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  starSeller?: boolean;

  @ApiPropertyOptional({ description: 'Comma-separated primary color names', example: 'red,blue' })
  @IsOptional()
  @IsString()
  colors?: string;

  @ApiPropertyOptional({
    description: 'Attribute filters (bracket notation) — e.g. attr[Material]=Bamboo',
  })
  @IsOptional()
  attr?: Record<string, string>;

  @ApiPropertyOptional({ enum: SearchSortBy })
  @IsOptional()
  @IsEnum(SearchSortBy)
  override sort?: SearchSortBy = SearchSortBy.RELEVANCE;
}
