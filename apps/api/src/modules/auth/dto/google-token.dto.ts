import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleTokenDto {
  @ApiProperty({ description: 'The ID token (JWT credential) returned by Google Identity Services' })
  @IsString()
  @IsNotEmpty()
  credential!: string;
}
