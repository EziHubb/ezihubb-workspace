import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiPropertyOptional({ description: 'Gift card code for partial payment' })
  @IsOptional()
  @IsString()
  giftCardCode?: string;
}

export class PaymentIntentResponseDto {
  @ApiProperty() clientSecret: string;
  @ApiProperty() amount: number;
  @ApiProperty() currency: string;
}
