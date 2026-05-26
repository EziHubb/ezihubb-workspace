import { IsString, IsOptional, IsBoolean, IsInt, Min, MaxLength, MinLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateCollectionDto {
  @ApiProperty({ example: "Valentine's Day" })
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
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiPropertyOptional({ example: "Valentine's Day" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occasion?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ example: '2025-02-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-02-14T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
