import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OffersScope } from '@prisma/client';

export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  offeredPrice!: number;
}

export class UpdateOffersSettingsDto {
  @ApiProperty()
  @IsBoolean()
  offersEnabled!: boolean;

  @ApiProperty({ enum: OffersScope })
  @IsEnum(OffersScope)
  offersScope!: OffersScope;

  @ApiPropertyOptional({ description: 'Null = receive all offers, no floor' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offersMaxDiscountPercent!: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}

export class CounterOfferDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  counterPrice!: number;
}
