import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class ReorderImagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

export class AttachImagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  urls: string[];
}
