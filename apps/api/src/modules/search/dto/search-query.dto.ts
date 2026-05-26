import {
  IsOptional,
  IsString,
  IsNumber,
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

export class SearchQueryDto extends PaginationDto {
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

  @ApiPropertyOptional({ enum: ProductSortBy })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sort?: ProductSortBy;
}
