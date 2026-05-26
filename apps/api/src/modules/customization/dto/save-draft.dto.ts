import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class SaveDraftDto {
  @ApiProperty({ description: 'Product ID being customized' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'Template/design identifier' })
  @IsString()
  templateId!: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ description: 'Serialized canvas/layer customization data' })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Uploaded image temp keys' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  uploadedImages?: string[];

  @ApiPropertyOptional({ description: 'Preview URL if already generated' })
  @IsOptional()
  @IsString()
  previewUrl?: string;
}
