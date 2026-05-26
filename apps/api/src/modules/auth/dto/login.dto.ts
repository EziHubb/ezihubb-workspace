import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @Transform(({ value }) => (value as string)?.toLowerCase().trim())
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}
