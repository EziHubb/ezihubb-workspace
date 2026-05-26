import { IsNumber, IsString, IsUppercase, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateShippingDto {
  @ApiProperty({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  @IsString()
  @IsUppercase()
  @Length(2, 2)
  countryCode!: string;

  @ApiProperty({ example: 99.99 })
  @IsNumber()
  @Min(0)
  orderTotal!: number;
}
