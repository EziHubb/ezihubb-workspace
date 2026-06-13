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
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiPropertyOptional() shippingName?: string;
  @ApiPropertyOptional() shippingCity?: string;
  @ApiPropertyOptional() shippingCountry?: string;
  @ApiPropertyOptional() shippingMethod?: string;
  @ApiPropertyOptional() shippingCost?: number;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional() customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  @ApiPropertyOptional() stores?: { name: string; slug: string }[];
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
