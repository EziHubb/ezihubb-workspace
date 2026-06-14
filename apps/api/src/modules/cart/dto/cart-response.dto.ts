import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty() productSlug: string;
  @ApiPropertyOptional() productImageUrl: string | null;
  @ApiPropertyOptional() variantId: string | null;
  @ApiPropertyOptional() variantName: string | null;
  @ApiPropertyOptional() variantOptions: Record<string, string> | null;
  @ApiProperty() quantity: number;
  /** Price at time of adding to cart */
  @ApiProperty() unitPrice: number;
  /** Current live price (may differ from unitPrice if product was repriced) */
  @ApiProperty() currentPrice: number;
  /** True when product price changed since item was added */
  @ApiProperty() priceChanged: boolean;
  @ApiPropertyOptional() customizationData: Record<string, unknown> | null;
  @ApiPropertyOptional() previewUrl: string | null;
}

export class ShippingEstimateDto {
  @ApiProperty() methodId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() carrier: string | null;
  @ApiProperty() price: number;
  @ApiProperty() minDays: number;
  @ApiProperty() maxDays: number;
  @ApiProperty() isFree: boolean;
}

export class CartTotalsDto {
  @ApiProperty() subtotal: number;
  @ApiProperty() discount: number;
  @ApiProperty() shipping: number;
  @ApiProperty() total: number;
  @ApiProperty() itemCount: number;
}

export class CartResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() userId: string | null;
  @ApiPropertyOptional() sessionId: string | null;
  @ApiPropertyOptional() couponCode: string | null;
  @ApiPropertyOptional() discountAmount: number | null;
  @ApiProperty({ type: [CartItemDto] }) items: CartItemDto[];
  @ApiProperty({ type: () => CartTotalsDto }) totals: CartTotalsDto;
}
