import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  /**
   * Which shop this is addressed to, when no order names one.
   *
   * The only way a conversation got a store was by deriving it from an order,
   * so "Message seller" on a product page — which has no order — produced a
   * conversation with storeId null. Two consequences, and the invisible one
   * was the serious one: the shop's inbox filters on its own storeId, so the
   * message was never delivered to anyone, and the partial unique index that
   * keeps one thread per buyer only binds rows WHERE storeId IS NOT NULL, so
   * every send started another thread.
   *
   * Accepted from the client rather than derived: a buyer can already open a
   * conversation with any shop by visiting its page, so naming one here grants
   * nothing they did not already have.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guestName?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}
