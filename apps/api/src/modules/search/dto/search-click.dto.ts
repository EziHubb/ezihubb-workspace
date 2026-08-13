import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchClickDto {
  @ApiProperty({ description: 'The search term that led to this product page view' })
  @IsString()
  @MinLength(1)
  term: string;
}
