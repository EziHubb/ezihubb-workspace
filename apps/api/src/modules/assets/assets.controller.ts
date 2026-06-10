import {
  Post, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsArray, IsString, ValidateNested, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { StorageService } from '../../common/services/storage.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';

class PresignFileDto {
  @ApiProperty({ example: 'photo.jpg' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  mimeType: string;
}

class PresignDto {
  @ApiProperty({ type: [PresignFileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(10)
  @Type(() => PresignFileDto)
  files: PresignFileDto[];
}

@AdminController('assets')
export class AssetsController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Get presigned PUT URLs for direct browser upload to R2' })
  async presign(@Body() dto: PresignDto) {
    const items = await Promise.all(
      dto.files.map((f) =>
        this.storage.getPresignedUploadUrl('products/images', f.name, f.mimeType),
      ),
    );
    return items;
  }
}
