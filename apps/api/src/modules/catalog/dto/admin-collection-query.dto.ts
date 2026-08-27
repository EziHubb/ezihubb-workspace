import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminCollectionQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Matches the collection name, case-insensitive.' })
  @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  occasion?: string;

  // Query strings carry 'true'/'false', which are both truthy as strings — an
  // unconverted value would filter every collection to isActive: true.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : undefined))
  @IsBoolean()
  isActive?: boolean;
}
