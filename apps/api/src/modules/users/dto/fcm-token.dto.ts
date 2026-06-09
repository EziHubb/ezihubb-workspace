import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class RegisterFcmTokenDto {
  @ApiProperty({ description: 'FCM device token' })
  @IsString()
  @Length(1, 512)
  token: string;

  @ApiPropertyOptional({ description: 'Device platform', enum: ['web', 'ios', 'android'] })
  @IsOptional()
  @IsString()
  @IsIn(['web', 'ios', 'android'])
  platform?: string;
}

export class UnregisterFcmTokenDto {
  @ApiProperty({ description: 'FCM device token to remove' })
  @IsString()
  @Length(1, 512)
  token: string;
}

export class UpdatePushPreferencesDto {
  @ApiProperty()
  @IsBoolean()
  pushEnabled: boolean;
}
