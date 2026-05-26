import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum SortOrder {
  ASC  = 'asc',
  DESC = 'desc',
}

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  page?: number = 1;

  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  limit?: number = 24;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 24);
  }
}
