import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength, ValidateNested } from 'class-validator';
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
  // Optional: an all-digital cart never collects a shipping address or method
  // — orders.service.ts checkout() enforces both as required when the cart
  // isn't 100% digital, since a DTO decorator alone can't express that.
  @ApiPropertyOptional({ type: ShippingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shippingMethodId?: string;

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
}
