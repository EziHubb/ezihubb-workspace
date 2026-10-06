import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class RequestGuestMessageAccessDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class VerifyGuestMessageAccessDto {
  @IsString()
  @Matches(/^[0-9A-Za-z]{12}$/)
  challengeId: string;

  @IsString()
  @Matches(/^\d{8}$/)
  code: string;
}
