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

/**
 * Attach a video that is already hosted elsewhere, instead of uploading one.
 *
 * Field names are snake_case here, unlike the rest of our API, because this
 * accepts a source payload verbatim rather than asking the caller to reshape
 * it first. The ValidationPipe whitelists by declared name, so these have to
 * match the incoming spelling exactly or they would be stripped in silence.
 */
export class AttachVideoDto {
  @ApiProperty({ example: 'https://cdn.example.com/video/abc.mp4', description: 'https only; must not point at our own storage' })
  @IsString()
  url: string;

  /**
   * ORDER MATTERS AND IS NOT THE SAME AS THE RESPONSE.
   *
   * On the way IN: [square, full-size] — the order the source payload uses.
   * On the way OUT (ProductVideoDto.thumbnailUrls): [full-size, square],
   * because the gallery and the card both take index 0 as the poster and a
   * 105px square stretched to gallery size looks like a broken image.
   *
   * Kept asymmetric on purpose: reversing the response instead would have
   * silently changed the poster on every listing already rendering one.
   */
  @ApiPropertyOptional({ type: [String], description: '[square, full-size] — note this is the reverse of the response order' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(2)
  thumbnail_urls?: string[];

  /** ISO 8601 (PT10S). Unparseable values are stored as null, not rejected. */
  @ApiPropertyOptional({ example: 'PT10S' })
  @IsOptional()
  @IsString()
  duration?: string;

  /** When the source published it. Defaults to now. Future dates are refused. */
  @ApiPropertyOptional({ example: '2026-08-09T07:52:56-04:00' })
  @IsOptional()
  @IsString()
  uploaded_at?: string;
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
