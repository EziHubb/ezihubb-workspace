import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaxPreviewDto {
  @ApiProperty({ example: '10001' })
  @IsString()
  postalCode: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  @IsString()
  @Length(2, 2)
  country: string;

  @ApiProperty({ description: 'Subtotal after discounts', example: 89.99 })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiProperty({ description: 'Shipping cost', example: 9.99 })
  @IsNumber()
  @Min(0)
  shippingCost: number;
}

export class TaxPreviewResponseDto {
  @ApiProperty() taxAmount:    number;
  @ApiProperty() taxRate:      number;
  @ApiProperty() jurisdiction: string;
}
