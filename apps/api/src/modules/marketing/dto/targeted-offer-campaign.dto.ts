import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, Max, Min } from 'class-validator';
import { DiscountType, TargetedOfferTrigger } from '@prisma/client';

export class UpsertTargetedOfferCampaignDto {
  @ApiProperty({ enum: TargetedOfferTrigger })
  @IsEnum(TargetedOfferTrigger)
  trigger!: TargetedOfferTrigger;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  discountValue!: number;

  @ApiProperty({ default: 3 })
  @IsInt()
  @Min(1)
  @Max(30)
  expiresAfterDays!: number;

  @ApiProperty({ default: 7 })
  @IsInt()
  @Min(1)
  @Max(90)
  lookbackDays!: number;

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
