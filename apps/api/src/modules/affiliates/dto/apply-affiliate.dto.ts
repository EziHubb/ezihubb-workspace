import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class ApplyAffiliateDto {
  @ApiProperty()
  @IsString()
  @Length(1, 50)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 50)
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Blog, YouTube, Instagram, TikTok URL, etc.' })
  @IsUrl({ require_tld: false })
  website!: string;

  @ApiProperty({ description: 'How they plan to promote — max 500 chars' })
  @IsString()
  @Length(10, 500)
  promoDescription!: string;

  @ApiPropertyOptional({ description: 'Requested referral code (4–20 uppercase alphanumeric)' })
  @IsOptional()
  @IsString()
  @Length(4, 20)
  @Matches(/^[A-Z0-9]+$/i, { message: 'Must be alphanumeric' })
  desiredReferralCode?: string;
}
