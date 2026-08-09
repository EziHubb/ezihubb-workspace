import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class GenerateFieldsPreviewDto {
  @ApiProperty({ description: 'Customization template ID (matches CustomizationTemplate.id)' })
  @IsString()
  templateId!: string;

  @ApiProperty({
    description:
      'Field values keyed by field id — a string for text/date/select fields, or ' +
      '{ imageKey?, processedImageKey?, bgRemoved?, artStyle? } for image fields',
  })
  @IsObject()
  fields!: Record<string, unknown>;
}
