import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { DiscountType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export type PromotionStatusFilter = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'SCHEDULED';

export class PromotionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by coupon code (case-insensitive contains)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: DiscountType })
  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'PAUSED', 'EXPIRED', 'SCHEDULED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'EXPIRED', 'SCHEDULED'])
  status?: PromotionStatusFilter;
}
