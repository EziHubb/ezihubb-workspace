import { IsOptional, IsString, MaxLength, MinLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarkShippedDto {
  @ApiProperty({ description: 'Carrier tracking number' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  trackingNumber: string;

  @ApiPropertyOptional({ description: 'Carrier code (USPS/UPS/FEDEX/DHL). Auto-detected from tracking number if omitted.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  carrier?: string;

  @ApiPropertyOptional({ description: 'Override auto-generated tracking URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
  /**
   * When the carrier actually receives it, which is not always now.
   *
   * A shop that packs on Friday for a Monday collection was previously stamped
   * with the moment they pressed the button, so the buyer's tracking email
   * claimed a dispatch that had not happened. Optional — omitted means now.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dispatchedAt?: string;
}
