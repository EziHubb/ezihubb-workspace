import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class SetOrderStageDto {
  @ApiProperty({
    enum: OrderStatus,
    description:
      "The stage this shop's part of the order has reached. Shipped comes " +
      'from the dispatch form and Completed from the progress steps, so ' +
      'neither is accepted here.',
  })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
