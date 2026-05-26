import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  @Type(() => Number)
  quantity: number;
}
