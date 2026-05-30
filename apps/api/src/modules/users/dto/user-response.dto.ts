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
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
