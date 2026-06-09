import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, Length, Matches } from 'class-validator';

export class TrackClickDto {
  @ApiProperty({ description: 'Affiliate referral code from cookie' })
  @IsString()
  @Length(4, 20)
  @Matches(/^[A-Z0-9]+$/, { message: 'referralCode must be uppercase alphanumeric' })
  referralCode!: string;

  @ApiProperty({ description: 'Anonymous visitor UUID from cookie' })
  @IsString()
  @Length(36, 36)
  visitorId!: string;

  @ApiProperty({ description: 'Full URL of the page the visitor landed on' })
  @IsUrl({ require_tld: false }) // allow localhost in dev
  landingPage!: string;
}
