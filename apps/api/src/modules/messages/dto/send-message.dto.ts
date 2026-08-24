import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachmentUrls?: string[];

  /**
   * A listing to share in the message, shown as a card with its live price.
   *
   * Only the id travels. Letting the client send a name and price would let it
   * quote whatever it liked in a thread the buyer reads as coming from the
   * shop.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachedProductId?: string;

  /**
   * Idempotency key, chosen by the sender before the request leaves.
   *
   * Send the same value when retrying and the server returns the message it
   * already stored instead of writing a second one. Omit it and the endpoint
   * behaves exactly as before — every existing caller keeps working.
   *
   * A UUID is expected but not enforced: the value only has to be unique
   * within one conversation, and rejecting a client that picked a different
   * unique scheme would buy nothing. Bounded so it cannot be used to write
   * arbitrary data into an indexed column.
   */
  @ApiPropertyOptional({ description: 'Client-chosen id; a repeat returns the stored message rather than duplicating it' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  clientMessageId?: string;
}
