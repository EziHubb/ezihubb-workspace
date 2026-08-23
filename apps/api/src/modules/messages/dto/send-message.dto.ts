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
}
