import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() role: string;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiProperty() isEmailVerified: boolean;
  @ApiPropertyOptional() phone: string | null;
  @ApiProperty({ description: 'Whether the account has a password set — false for Google-only accounts that never set one' })
  hasPassword: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromPrisma(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.firstName = user.firstName ?? '';
    dto.lastName = user.lastName ?? '';
    dto.role = user.role;
    dto.avatarUrl = user.avatarUrl;
    dto.isEmailVerified = user.isEmailVerified;
    dto.phone = user.phone;
    dto.hasPassword = !!user.passwordHash;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
