import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { Store } from '@prisma/client';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyThrottlerGuard } from '../../common/guards/api-key-throttler.guard';
import { ProductsService } from '../products/products.service';
import { ProductQueryDto } from '../products/dto/product-query.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { ProductImageResponseDto } from '../products/dto/product-response.dto';
import { AttachImagesDto, ReorderImagesDto } from '../products/dto/product-image.dto';

@Controller('partner/products')
@UseGuards(ApiKeyGuard, ApiKeyThrottlerGuard)
@ApiSecurity('apiKey')
@ApiTags('Partner API - Products')
export class PartnerProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products in your store' })
  async list(
    @Req() req: Request & { store: Store },
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findAll({
      ...query,
      storeId: req.store.id,
      includeInactive: true,
    } as Parameters<typeof this.productsService.findAll>[0]);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  async findOne(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
  ) {
    return this.productsService.findByIdForStore(id, req.store.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product in your store' })
  async create(
    @Req() req: Request & { store: Store },
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(dto, req.store.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (soft) a product' })
  async remove(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
  ) {
    await this.productsService.deleteForStore(id, req.store.id);
  }

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { images: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({ summary: 'Upload product images (JPEG/PNG/WebP, max 10 MB each, up to 10 at once)' })
  @ApiResponse({ status: 201, type: [ProductImageResponseDto] })
  @HttpCode(HttpStatus.CREATED)
  async uploadImages(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ProductImageResponseDto[]> {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.uploadImages(id, files);
  }

  @Post(':id/images/from-urls')
  @ApiOperation({ summary: 'Attach already-uploaded image URLs to a product' })
  @ApiResponse({ status: 201, type: [ProductImageResponseDto] })
  @HttpCode(HttpStatus.CREATED)
  async attachImages(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Body() dto: AttachImagesDto,
  ): Promise<ProductImageResponseDto[]> {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.attachImageUrls(id, dto.urls);
  }

  @Delete(':id/images/:imgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product image' })
  async deleteImage(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Param('imgId') imgId: string,
  ) {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.deleteImage(id, imgId);
  }

  @Patch(':id/images/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reorder product images' })
  async reorderImages(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Body() dto: ReorderImagesDto,
  ) {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.reorderImages(id, dto.orderedIds);
  }
}
