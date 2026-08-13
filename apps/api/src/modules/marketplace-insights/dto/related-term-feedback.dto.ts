import { IsBoolean, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RelatedTermFeedbackDto {
  @ApiProperty({ description: 'The suggested related term this feedback is about' })
  @IsString()
  @MinLength(1)
  relatedTerm: string;

  @ApiProperty({ description: 'true = helpful (thumbs up), false = not helpful (thumbs down)' })
  @IsBoolean()
  helpful: boolean;
}
