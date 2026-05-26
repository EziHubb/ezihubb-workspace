import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() role: string;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiProperty() isEmailVerified: boolean;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: () => AuthUserDto }) user: AuthUserDto;
}
