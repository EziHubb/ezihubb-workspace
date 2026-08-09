import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export class OrderItemDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() productId: string | null;
  @ApiPropertyOptional() variantId: string | null;
  @ApiProperty() productName: string;
  @ApiPropertyOptional() productSlug: string | null;
  @ApiPropertyOptional() variantName: string | null;
  @ApiPropertyOptional() variantSnapshot: Record<string, string> | null;
  @ApiPropertyOptional() sku: string | null;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() totalPrice: number;
  @ApiPropertyOptional() customizationData: Record<string, unknown> | null;
  @ApiPropertyOptional() previewUrl: string | null;
  @ApiPropertyOptional() imageUrl: string | null;
  @ApiPropertyOptional() product?: { name: string; slug: string | null; imageUrl?: string | null };
}

export class OrderPaymentDto {
  @ApiProperty() id: string;
  @ApiProperty() method: string;
  @ApiProperty({ enum: PaymentStatus }) status: PaymentStatus;
  @ApiProperty() amount: number;
  @ApiProperty() currency: string;
  @ApiPropertyOptional() stripePaymentIntentId: string | null;
  @ApiPropertyOptional() giftCardCode: string | null;
  @ApiPropertyOptional() giftCardAmount: number | null;
  @ApiProperty() refundedAmount: number;
  @ApiPropertyOptional() paidAt: Date | null;
}

export class OrderStatusHistoryDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiPropertyOptional() note: string | null;
  @ApiPropertyOptional() createdBy: string | null;
  @ApiProperty() createdAt: Date;
}

export class OrderCustomerDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() firstName: string | null;
  @ApiPropertyOptional() lastName: string | null;
  @ApiProperty() email: string;
  @ApiPropertyOptional() phone: string | null;
}

export class OrderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() orderNumber: string;
  @ApiPropertyOptional() userId: string | null;
  @ApiPropertyOptional() guestEmail: string | null;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;

  @ApiProperty() shippingName: string;
  @ApiProperty() shippingPhone: string;
  @ApiProperty() shippingAddress: string;
  @ApiProperty() shippingCity: string;
  @ApiPropertyOptional() shippingState: string | null;
  @ApiProperty() shippingZip: string;
  @ApiProperty() shippingCountry: string;
  @ApiProperty() shippingMethod: string;
  @ApiProperty() shippingCost: number;

  @ApiProperty() subtotal: number;
  @ApiProperty() discountAmount: number;
  @ApiProperty() total: number;
  @ApiPropertyOptional() couponCode: string | null;

  @ApiPropertyOptional() trackingNumber: string | null;
  @ApiPropertyOptional() trackingUrl: string | null;
  @ApiPropertyOptional() carrier: string | null;
  @ApiPropertyOptional() trackerId: string | null;

  @ApiProperty()         isGift:          boolean;
  @ApiPropertyOptional() giftMessage:     string | null;
  @ApiPropertyOptional() giftFrom:        string | null;
  @ApiProperty()         giftReceipt:     boolean;
  @ApiProperty()         giftWrapping:    boolean;

  @ApiPropertyOptional() note: string | null;
  @ApiPropertyOptional() privateNote: string | null;
  @ApiPropertyOptional() cancelReason: string | null;
  @ApiPropertyOptional() cancelledAt: Date | null;
  @ApiPropertyOptional() confirmedAt: Date | null;
  @ApiPropertyOptional() shippedAt: Date | null;
  @ApiPropertyOptional() deliveredAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  @ApiPropertyOptional({ type: () => OrderCustomerDto })
  customer: OrderCustomerDto | null;

  @ApiProperty({ type: [OrderItemDto] }) items: OrderItemDto[];
  @ApiPropertyOptional({ type: () => OrderPaymentDto })
  payment: OrderPaymentDto | null;
  @ApiProperty({ type: [OrderStatusHistoryDto] })
  statusHistory: OrderStatusHistoryDto[];
}
