import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class GeneratePreviewDto {
  @ApiProperty({ description: 'Draft ID to generate a preview for' })
  @IsString()
  draftId!: string;

  @ApiProperty({ description: 'Canvas/layer data describing the composition' })
  @IsObject()
  canvasData!: Record<string, unknown>;
}
