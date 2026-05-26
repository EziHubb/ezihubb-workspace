import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() orderId: string;
  @ApiProperty({ enum: PaymentMethod }) method: PaymentMethod;
  @ApiProperty({ enum: PaymentStatus }) status: PaymentStatus;
  @ApiProperty() amount: number;
  @ApiProperty() currency: string;
  @ApiPropertyOptional() stripePaymentIntentId: string | null;
  @ApiPropertyOptional() stripeChargeId: string | null;
  @ApiPropertyOptional() paypalOrderId: string | null;
  @ApiPropertyOptional() giftCardCode: string | null;
  @ApiPropertyOptional() giftCardAmount: number | null;
  @ApiProperty() refundedAmount: number;
  @ApiPropertyOptional() refundedAt: Date | null;
  @ApiPropertyOptional() refundReason: string | null;
  @ApiPropertyOptional() paidAt: Date | null;
  @ApiProperty() createdAt: Date;
}

export class GiftCardResponseDto {
  @ApiProperty() code: string;
  @ApiProperty() balance: number;
  @ApiProperty() initialValue: number;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional() expiresAt: Date | null;
}
