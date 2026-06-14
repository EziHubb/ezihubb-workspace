import { IsOptional, IsString, IsBoolean, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { CampaignSeason } from '@prisma/client';

export class CreateCampaignDto {
  @ApiProperty()         @IsString()                              name:          string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(CampaignSeason)   season?:       CampaignSeason;
  @ApiPropertyOptional() @IsOptional() @IsString()               bannerText?:   string;
  @ApiPropertyOptional() @IsOptional() @IsString()               ctaLabel?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString()               ctaHref?:      string;
  @ApiPropertyOptional() @IsOptional() @IsString()               gradient?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString()               primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()               accentColor?:  string;
  @ApiPropertyOptional() @IsOptional() @IsString()               bgColor?:      string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()           startDate?:    string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()           endDate?:      string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()           countdownEnd?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional() @IsOptional() @IsString()               name?:         string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(CampaignSeason)   season?:       CampaignSeason;
  @ApiPropertyOptional() @IsOptional() @IsString()               bannerText?:   string;
  @ApiPropertyOptional() @IsOptional() @IsString()               ctaLabel?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString()               ctaHref?:      string;
  @ApiPropertyOptional() @IsOptional() @IsString()               gradient?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString()               primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()               accentColor?:  string;
  @ApiPropertyOptional() @IsOptional() @IsString()               bgColor?:      string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean()              isActive?:     boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString()           countdownEnd?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()           startDate?:    string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()           endDate?:      string;
}
