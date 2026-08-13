import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TitleSuggestionRequestDto {
  @ApiProperty({ description: 'Current listing title (or working draft)' })
  @IsString()
  @MaxLength(500)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoryName?: string;
}

export class TitleSuggestionResponseDto {
  @ApiProperty() suggestedTitle: string;
}
