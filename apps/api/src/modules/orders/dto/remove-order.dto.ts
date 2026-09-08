import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RemoveOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
