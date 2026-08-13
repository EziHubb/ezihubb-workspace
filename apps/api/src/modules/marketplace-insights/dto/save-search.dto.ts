import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveSearchDto {
  @ApiProperty({ description: 'The search term to save for later tracking' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  term: string;
}
