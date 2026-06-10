import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseGiftCardDto {
  @ApiProperty({ example: 25, description: 'Gift card value in USD (10–500)' })
  @IsNumber()
  @Min(10)
  @Max(500)
  amount: number;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  recipientEmail: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  recipientName?: string;

  @ApiPropertyOptional({ example: 'Happy Birthday!' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  personalMessage?: string;

  @ApiProperty({ description: 'Stripe PaymentMethod ID from client' })
  @IsString()
  paymentMethodId: string;
}
