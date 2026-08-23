import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Bodies for the order detail panel's two write actions. */

export class SetPrivateNoteDto {
  /**
   * Null or an empty string clears the note. Capped so a stray paste cannot
   * put an unbounded blob on a screen the seller opens on every order.
   */
  @ApiPropertyOptional({ description: 'Seller-only note; null or empty clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

export class SendOrderMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  /**
   * Matches the three-attachment limit `Message.attachmentUrls` documents.
   *
   * `require_tld: false` so a local storage endpoint still validates in
   * development. That is safe because this is not the security check: the
   * service rejects any URL that does not point at our own storage, which is
   * what stops an arbitrary address being rendered as an image in a buyer's
   * inbox. This only rules out strings that are not URLs at all.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUrl({ require_tld: false }, { each: true })
  attachmentUrls?: string[];
}
