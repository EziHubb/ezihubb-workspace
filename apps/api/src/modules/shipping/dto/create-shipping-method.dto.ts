import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateShippingMethodDto {
  @ApiProperty({ example: 'Standard Shipping' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'USPS' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiProperty({ example: 9.99 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 75, description: 'Order subtotal above which shipping is free' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeShippingOver?: number;

  @ApiProperty({ example: 3, description: 'Minimum delivery days' })
  @IsInt()
  @Min(0)
  minDays!: number;

  @ApiProperty({ example: 7, description: 'Maximum delivery days' })
  @IsInt()
  @Min(0)
  maxDays!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  isActive?: boolean = true;
}

export class UpdateShippingMethodDto extends PartialType(CreateShippingMethodDto) {}
