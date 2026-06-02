import {
  Controller, Post, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsString, ValidateNested, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { StorageService } from '../../common/services/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';

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

@ApiTags('Admin — Assets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/assets')
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
    return { data: items };
  }
}
