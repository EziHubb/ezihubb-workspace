import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ConversationWithUserDto {
  @ApiProperty({ description: 'The customer account to open the platform thread with.' })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
