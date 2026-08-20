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
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { Store } from '@prisma/client';
import { PrintSide } from '@prisma/client';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyThrottlerGuard } from '../../common/guards/api-key-throttler.guard';
import { ProductsService } from '../products/products.service';
import { ProductQueryDto } from '../products/dto/product-query.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { ProductImageResponseDto, DigitalFileResponseDto, ProductVideoDto } from '../products/dto/product-response.dto';
import { AttachImagesDto, ReorderImagesDto, AttachPrintFileDto, UploadDigitalFilesDto, ReorderDigitalFilesDto } from '../products/dto/product-image.dto';

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

  // ─── Print files ────────────────────────────────────────────────────────
  // A print file is an isolated, background-removed design asset for one
  // print area — never shown to shoppers, only used when this product's
  // orders are pushed to a POD fulfillment provider (e.g. Merchize). If you
  // already have a real design file for this product, attach it here; the
  // admin UI also supports generating one from an existing catalog photo.

  @Post(':id/print-files')
  @ApiOperation({ summary: 'Attach a print file (isolated design artwork) for one print side — separate from catalog images' })
  @ApiResponse({ status: 201, type: ProductImageResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async attachPrintFile(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Body() dto: AttachPrintFileDto,
  ): Promise<ProductImageResponseDto> {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.attachPrintFile(id, dto.url, dto.printSide);
  }

  @Delete(':id/print-files/:printSide')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the print file for one side' })
  async deletePrintFile(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Param('printSide') printSide: PrintSide,
  ) {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.deletePrintFile(id, printSide);
  }

  // ─── Digital files (the sold deliverable for DIGITAL products) ───────────

  @Post(':id/digital-files')
  @UseInterceptors(FilesInterceptor('files', 20, { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } }, variantId: { type: 'string' } } } })
  @ApiOperation({ summary: 'Upload digital deliverable files (max 50 MB each, up to 20 at once)' })
  @ApiResponse({ status: 201, type: [DigitalFileResponseDto] })
  @HttpCode(HttpStatus.CREATED)
  async uploadDigitalFiles(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadDigitalFilesDto,
  ): Promise<DigitalFileResponseDto[]> {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.uploadDigitalFiles(id, files, dto.variantId);
  }

  @Delete(':id/digital-files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a digital deliverable file' })
  async deleteDigitalFile(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.deleteDigitalFile(id, fileId);
  }

  @Patch(':id/digital-files/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reorder digital deliverable files' })
  async reorderDigitalFiles(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Body() dto: ReorderDigitalFilesDto,
  ) {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.reorderDigitalFiles(id, dto.orderedIds);
  }

  // ─── Videos ────────────────────────────────────────────────────────────────
  //
  // Same limits as the seller UI enforces, applied in the service rather than
  // here, so a partner integration cannot get a laxer deal than a human
  // uploading through the dashboard: MP4/WebM/MOV, <= 20 MB, <= 10 seconds,
  // at most 2 per product. Poster frames are extracted server-side — a partner
  // uploads one file and gets the thumbnails back, it never supplies them.

  @Get(':id/videos')
  @ApiOperation({ summary: 'List the videos on a product' })
  @ApiResponse({ status: 200, type: [ProductVideoDto] })
  async listVideos(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
  ): Promise<ProductVideoDto[]> {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.listVideos(id);
  }

  @Post(':id/videos')
  @UseInterceptors(FileInterceptor('video', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { video: { type: 'string', format: 'binary' } } } })
  @ApiOperation({
    summary:
      'Upload a product video (MP4/WebM/MOV, max 10s, max 20 MB, max 2 per product). ' +
      'Poster frames and duration are derived server-side and returned in the response.',
  })
  @ApiResponse({ status: 201, type: ProductVideoDto })
  @HttpCode(HttpStatus.CREATED)
  async uploadVideo(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProductVideoDto> {
    await this.productsService.findByIdForStore(id, req.store.id);
    // Returns only the created video, not the whole legacy envelope the admin
    // route still hands back — a new API surface has no reason to inherit a
    // deprecated field.
    const { video } = await this.productsService.uploadVideo(id, file);
    return video;
  }

  @Delete(':id/videos/:videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product video and its poster frames' })
  async deleteVideo(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ): Promise<void> {
    await this.productsService.findByIdForStore(id, req.store.id);
    await this.productsService.deleteVideoById(id, videoId);
  }
}
