import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.trim())
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.trim())
  lastName?: string;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
