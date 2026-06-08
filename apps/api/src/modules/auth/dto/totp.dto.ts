import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsNotEmpty } from 'class-validator';

export class TotpVerifyDto {
  @ApiProperty() @IsString() @IsNotEmpty() partialToken!: string;
  @ApiProperty() @IsString() @Length(6, 8) code!: string;
}

export class TotpConfirmDto {
  @ApiProperty() @IsString() @IsNotEmpty() secret!: string;
  @ApiProperty() @IsString() @Length(6, 6) code!: string;
}

export class TotpDisableDto {
  @ApiProperty() @IsString() @Length(6, 8) code!: string;
}

export class TotpSetupResponseDto {
  @ApiProperty() secret!: string;
  @ApiProperty() qrCodeDataUrl!: string;
}

export class TotpRequiredResponseDto {
  @ApiProperty() requiresTOTP!: true;
  @ApiProperty() partialToken!: string;
}
