import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UploadedFiles,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductImageResponseDto } from './dto/product-response.dto';
import { ProductListItemDto } from './dto/product-list-item.dto';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ReorderImagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

@ApiTags('Admin — Products')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // GET /admin/products
  @Get()
  @ApiOperation({ summary: '[Admin] List products (includes inactive)' })
  findAll(@Query() query: ProductQueryDto): Promise<PaginatedResult<ProductListItemDto>> {
    return this.productsService.findAll({ ...query, includeInactive: true });
  }

  // POST /admin/products
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create product with variants' })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(dto);
  }

  // PATCH /admin/products/:id
  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Update product' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  update(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, dto);
  }

  // DELETE /admin/products/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Soft-delete product (sets isActive=false)' })
  delete(@Param('id', ParseCuidPipe) id: string): Promise<void> {
    return this.productsService.delete(id);
  }

  // POST /admin/products/:id/duplicate
  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Duplicate product (deep copy, draft state)' })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  duplicate(@Param('id', ParseCuidPipe) id: string): Promise<ProductResponseDto> {
    return this.productsService.duplicate(id);
  }

  // POST /admin/products/:id/images
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { images: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({ summary: '[Admin] Upload product images (JPEG/PNG/WebP, max 10 MB each, up to 10 at once)' })
  @ApiResponse({ status: 201, type: [ProductImageResponseDto] })
  @HttpCode(HttpStatus.CREATED)
  uploadImages(
    @Param('id', ParseCuidPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ProductImageResponseDto[]> {
    return this.productsService.uploadImages(id, files);
  }

  // DELETE /admin/products/:id/images/:imgId
  @Delete(':id/images/:imgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete product image' })
  deleteImage(
    @Param('id', ParseCuidPipe) id: string,
    @Param('imgId', ParseCuidPipe) imgId: string,
  ): Promise<void> {
    return this.productsService.deleteImage(id, imgId);
  }

  // PATCH /admin/products/:id/images/reorder
  @Patch(':id/images/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Reorder product images' })
  reorderImages(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: ReorderImagesDto,
  ): Promise<void> {
    return this.productsService.reorderImages(id, dto.orderedIds);
  }
}
