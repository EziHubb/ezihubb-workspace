import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class ShippingAddressDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  fullName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  addressLine1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  postalCode: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @Length(2, 2)
  @Transform(({ value }) => (value as string)?.toUpperCase().trim())
  country: string;
}

export class CheckoutDto {
  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiProperty()
  @IsString()
  shippingMethodId: string;

  @ApiPropertyOptional({ description: 'Required for guest checkout' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (value as string)?.toLowerCase().trim())
  guestEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  giftCardCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isGift?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  giftMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  giftFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  giftReceipt?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  giftWrapping?: boolean;

  @ApiPropertyOptional({ description: 'Loyalty points to redeem (logged-in users only)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pointsToRedeem?: number;
}

export class CancelOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Required for guest order cancellation' })
  @IsOptional()
  @IsEmail()
  guestEmail?: string;
}

export class CheckoutResponseDto {
  @ApiProperty() orderId:      string;
  @ApiProperty() orderNumber:  string;
  @ApiProperty() clientSecret: string;
  @ApiProperty() total:        number;
  @ApiProperty() taxAmount:    number;
}
