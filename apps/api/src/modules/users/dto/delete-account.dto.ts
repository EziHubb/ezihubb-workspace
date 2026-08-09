import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Current password — required unless the account uses social login only' })
  @IsOptional()
  @IsString()
  password?: string;
}
