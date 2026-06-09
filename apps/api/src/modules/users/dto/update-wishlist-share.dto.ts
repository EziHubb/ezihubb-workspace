import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWishlistShareDto {
  @ApiPropertyOptional({ description: 'Wishlist display name (max 100 chars)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
