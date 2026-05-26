import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTrackingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  carrier: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  trackingNumber: string;

  @ApiPropertyOptional({ description: 'Override auto-generated tracking URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;
}
