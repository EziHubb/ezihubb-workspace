import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}
