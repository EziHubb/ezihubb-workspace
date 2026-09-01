import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';

export class CartItemDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty() productSlug: string;
  @ApiProperty({ enum: ProductType }) productType: ProductType;
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

export class ShippingEstimateStoreDto {
  @ApiProperty() storeId: string;
  @ApiProperty() cost: number;
  @ApiProperty() shippingSubsidy: number;
  @ApiProperty() methodName: string;
  @ApiProperty() minDays: number;
  @ApiProperty() maxDays: number;
}

export class ShippingEstimateDto {
  /** False when any cart item lacks a resolvable delivery profile for the given destination — the buyer's cart can't be priced yet. */
  @ApiProperty() resolvable: boolean;
  @ApiProperty({ type: [ShippingEstimateStoreDto] }) perStore: ShippingEstimateStoreDto[];
  @ApiProperty() totalCost: number;
  @ApiProperty() freeShippingThreshold: number;
  @ApiProperty() freeShippingApplied: boolean;
  @ApiProperty() platformFreeShippingApplied: boolean;
  @ApiProperty() shippingSubsidy: number;
  @ApiPropertyOptional() minDays: number | null;
  @ApiPropertyOptional() maxDays: number | null;
}

export class CartTotalsDto {
  @ApiProperty() subtotal: number;
  @ApiProperty() discount: number;
  @ApiProperty() shipping: number;
  @ApiProperty() total: number;
  @ApiProperty() itemCount: number;
  @ApiProperty() freeShippingThreshold: number;
  @ApiProperty() freeShippingEligible: boolean;
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
