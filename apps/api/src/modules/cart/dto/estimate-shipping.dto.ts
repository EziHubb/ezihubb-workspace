import { IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class EstimateShippingDto {
  @ApiProperty({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  @IsString()
  @Length(2, 2)
  @Transform(({ value }) => (value as string)?.toUpperCase().trim())
  country: string;

  @ApiPropertyOptional({ example: 'CA' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '90210' })
  @IsOptional()
  @IsString()
  postalCode?: string;
}
