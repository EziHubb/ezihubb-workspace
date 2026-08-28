import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ConversationWithUserDto {
  @ApiProperty({ description: 'The customer account to open a conversation with in the active seat.' })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
