import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 99.99, description: 'Order subtotal before coupon is applied' })
  @IsNumber()
  @Min(0)
  orderTotal!: number;
}
