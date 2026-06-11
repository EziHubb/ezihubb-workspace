import { IsEmail, IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @Transform(({ value }) => (value as string)?.toLowerCase().trim())
  email: string;

  @ApiProperty({ minLength: 8, example: 'Secret@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?])/, {
    message: 'Password must contain at least one uppercase letter, one digit, and one special character',
  })
  password: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.trim())
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.trim())
  lastName: string;

  @ApiPropertyOptional({ example: 'JANE1234', description: 'Referral code of the user who referred you' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  @Transform(({ value }) => (value as string)?.toUpperCase().trim())
  referralCode?: string;
}
