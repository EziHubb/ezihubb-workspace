import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ApplyCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.toUpperCase().trim())
  code: string;
}
