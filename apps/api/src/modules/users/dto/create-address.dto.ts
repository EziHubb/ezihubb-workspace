import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '123 Maple Street' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  line1: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty({ example: 'Toronto' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: 'Ontario' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ example: 'M5H 2N2' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode: string;

  @ApiProperty({ example: 'CA', minLength: 2, maxLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  @Transform(({ value }) => (value as string)?.toUpperCase())
  country: string;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
