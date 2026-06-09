import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty({ enum: ['paypal', 'bank_transfer', 'store_credit'] })
  @IsIn(['paypal', 'bank_transfer', 'store_credit'])
  paymentMethod!: string;

  @ApiProperty({ description: 'PayPal email, bank account number, etc.' })
  @IsString()
  @Length(1, 200)
  paymentDetail!: string;

  @ApiProperty({ description: 'Amount to withdraw (must not exceed available balance)' })
  @IsNumber()
  @IsPositive()
  amount!: number;
}
