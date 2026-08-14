import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LinkClickKind } from '@prisma/client';

export class TrackClickDto {
  @ApiProperty()
  @IsString()
  storeId!: string;

  @ApiProperty({ enum: LinkClickKind })
  @IsEnum(LinkClickKind)
  kind!: LinkClickKind;

  @ApiProperty()
  @IsString()
  visitorId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'SHARE_SAVE only — the buyer who generated the personalized link' })
  @IsOptional()
  @IsString()
  sharerId?: string;
}
