import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionDocument } from '@mlh/constants';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() role: string;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiProperty() isEmailVerified: boolean;
  @ApiPropertyOptional() storeId: string | null;
  @ApiProperty() isSeller: boolean;
  @ApiPropertyOptional() permissions: PermissionDocument | null;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: () => AuthUserDto }) user: AuthUserDto;
}
