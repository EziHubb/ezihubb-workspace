import { IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCampaignDto {
  @ApiPropertyOptional() @IsOptional() @IsString()  bannerText?:   string;
  @ApiPropertyOptional() @IsOptional() @IsString()  ctaLabel?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString()  ctaHref?:      string;
  @ApiPropertyOptional() @IsOptional() @IsString()  gradient?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString()  primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  accentColor?:  string;
  @ApiPropertyOptional() @IsOptional() @IsString()  bgColor?:      string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?:     boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() countdownEnd?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?:   string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?:     string;
}
