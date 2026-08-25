import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class LinkPreviewQueryDto {
  /**
   * The link to unfurl. Validated as a URL by the service rather than here,
   * because a bad one has to come back as one error shape alongside "that
   * link was not sent in this conversation" — and the length cap is the part
   * that matters before anything is parsed.
   */
  @ApiProperty()
  @IsString()
  @MaxLength(2048)
  url: string;
}
