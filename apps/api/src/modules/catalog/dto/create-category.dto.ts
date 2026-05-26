import { IsString, IsOptional, IsBoolean, IsInt, Min, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Custom Mugs' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => (value as string)?.trim())
  name: string;

  @ApiPropertyOptional({ description: 'Auto-generated from name if omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Parent category id (max 1 level deep)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
