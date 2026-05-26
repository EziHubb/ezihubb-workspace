import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class OrderListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty() total: number;
  @ApiProperty() itemCount: number;
  @ApiPropertyOptional() previewUrl: string | null;
  @ApiProperty() createdAt: Date;
}

export class AdminOrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  endDate?: string;
}
