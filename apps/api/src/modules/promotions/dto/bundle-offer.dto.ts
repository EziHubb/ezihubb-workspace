import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateBundleOfferDto {
  @ApiProperty({ example: 15, description: 'Percentage off the combined price when all listings are bought together' })
  @IsNumber()
  @Min(1)
  @Max(75)
  discountPercent!: number;

  @ApiProperty({ type: [String], description: '2–3 product IDs that make up the bundle' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  productIds!: string[];
}

export class UpdateBundleOfferDto {
  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(75)
  discountPercent?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BundleOfferResponseDto {
  id!: string;
  storeId!: string;
  discountPercent!: number;
  isActive!: boolean;
  createdAt!: Date;
  products!: { id: string; name: string; price: number; images: string[] }[];
}
