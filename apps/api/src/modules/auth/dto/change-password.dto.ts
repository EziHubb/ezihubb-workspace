import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ minLength: 8, example: 'NewSecret@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?])/, {
    message: 'Password must contain at least one uppercase letter, one digit, and one special character',
  })
  newPassword: string;
}
