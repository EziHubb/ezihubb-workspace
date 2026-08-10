import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { PrintSide } from '@prisma/client';

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

export class DeleteVideoDto {
  @ApiProperty()
  @IsString()
  url: string;
}

// ─── Print files (isolated design artwork for POD fulfillment — never shown
// to shoppers, see ProductImageType.PRINT_FILE) ────────────────────────────

export class GeneratePrintFileDto {
  @ApiProperty({ description: 'id of one of this product\'s own MOCKUP images to use as the background-removal source' })
  @IsString()
  sourceImageId: string;

  @ApiProperty({ enum: PrintSide })
  @IsEnum(PrintSide)
  printSide: PrintSide;
}

export class ApprovePrintFileDto {
  @ApiProperty({ description: 'The processedKey returned by the background-removal job once it completes' })
  @IsString()
  processedKey: string;
}

export class AttachPrintFileDto {
  @ApiProperty({ description: 'Already-uploaded/hosted URL of a real print-ready design file' })
  @IsString()
  url: string;

  @ApiProperty({ enum: PrintSide })
  @IsEnum(PrintSide)
  printSide: PrintSide;
}

// ─── Digital files (the sold deliverable for DIGITAL products) ────────────

export class UploadDigitalFilesDto {
  @ApiPropertyOptional({ description: 'Scope this upload to one variant; omitted = applies to all variants' })
  @IsOptional()
  @IsString()
  variantId?: string;
}

export class ReorderDigitalFilesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}
