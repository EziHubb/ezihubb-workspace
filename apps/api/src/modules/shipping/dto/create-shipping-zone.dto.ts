import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsUppercase, Length } from 'class-validator';

export class CreateShippingZoneDto {
  @ApiProperty({ example: 'North America' })
  @IsString()
  name!: string;

  @ApiProperty({ example: ['US', 'CA', 'MX'], description: 'ISO 3166-1 alpha-2 country codes' })
  @IsArray()
  @IsString({ each: true })
  @IsUppercase({ each: true })
  @Length(2, 2, { each: true })
  countries!: string[];
}

export class UpdateShippingZoneDto extends PartialType(CreateShippingZoneDto) {}
