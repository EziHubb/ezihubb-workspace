import {
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductStatus } from '@prisma/client';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductImageResponseDto } from './dto/product-response.dto';
import { ProductListItemDto } from './dto/product-list-item.dto';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import {
  IsArray, IsString, ArrayMaxSize, IsOptional, IsBoolean,
  IsNumber, IsEnum, MaxLength, ValidateNested, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  CreateProductDetailDto,
  VariantDto,
  AttributeDto,
  CustomizationTemplateDto,
  SetAttributesDto,
} from './dto/create-product-detail.dto';

class ReorderImagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

class AttachImagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  urls: string[];
}

// ── Variation DTOs ────────────────────────────────────────────────────────────

class VariationOptionCreateDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(100) value?: string;
  @IsOptional() @IsString() @MaxLength(20) colorHex?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imageId?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

class VariationGroupCreateDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() displayType?: string;
  @IsOptional() @ValidateNested({ each: true }) @Type(() => VariationOptionCreateDto)
  options?: VariationOptionCreateDto[];
}

class BulkSaveVariationsDto {
  @IsArray() groups: object[];
}

class VariationSettingsDto {
  @IsOptional() @IsBoolean() enableVariations?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) variesBy?: string[];
  @IsOptional() @IsString() skuPrefix?: string;
}

class VariationOptionPatchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() value?: string;
  @IsOptional() @IsString() colorHex?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imageId?: string;
  @IsOptional() @IsNumber() priceDelta?: number;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

class VariantPatchDto {
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsNumber() compareAtPrice?: number;
  @IsOptional() @IsString() sku?: string;
}

class ReorderIdsDto {
  @IsArray() @IsString({ each: true }) orderedIds: string[];
}

// ── Custom Option DTOs ────────────────────────────────────────────────────────

class CustomOptionCreateDto {
  @IsString() type: string;
  @IsString() @MaxLength(200) label: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsString() instructionText?: string;
  @IsOptional() @IsString() placeholder?: string;
  @IsOptional() @IsNumber() maxLength?: number;
  @IsOptional() @IsBoolean() isMultiline?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) choices?: string[];
  @IsOptional() @IsBoolean() allowMultiSelect?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) acceptedFileTypes?: string[];
  @IsOptional() @IsNumber() maxFileSizeMB?: number;
}

// ── Bulk action DTOs ──────────────────────────────────────────────────────────

class BulkProductActionDto {
  @IsArray() @IsString({ each: true }) @ArrayMaxSize(200) ids: string[];
  @IsIn(['publish', 'unpublish', 'archive', 'set-sale']) action: string;
  @IsOptional() payload?: Record<string, unknown>;
}

class BulkExportDto {
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(2000) ids?: string[];
}

@AdminController('products')
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // GET /admin/products
  @Get()
  @ApiOperation({ summary: '[Admin] List products (includes inactive)' })
  findAll(@Query() query: ProductQueryDto): Promise<PaginatedResult<ProductListItemDto>> {
    return this.productsService.findAll(Object.assign({}, query, { includeInactive: true }) as any);
  }

  // GET /admin/products/:id  — full product for the edit form
  @Get(':id')
  @ApiOperation({ summary: '[Admin] Get full product by ID for the edit form' })
  findById(@Param('id', ParseCuidPipe) id: string) {
    return this.productsService.findByIdAdmin(id);
  }

  // GET /admin/products/:id/performance?range=7d|30d|90d|1y|all
  @Get(':id/performance')
  @ApiOperation({ summary: '[Admin] Get performance stats for a product (Performance tab)' })
  getPerformance(
    @Param('id', ParseCuidPipe) id: string,
    @Query('range') range?: string,
  ) {
    return this.productsService.getPerformanceStats(id, range ?? '30d');
  }

  // POST /admin/products/draft
  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Auto-create a draft product to obtain a productId before form submission' })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  createDraft(): Promise<ProductResponseDto> {
    return this.productsService.createDraft();
  }

  // POST /admin/products
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create product with variants' })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  async create(@Req() req: Request, @Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.productsService.create(dto);
    const userId = (req.user as { sub: string }).sub;
    this.auditLog.log({
      userId,
      action:     'CREATE',
      entityType: 'Product',
      entityId:   product.id,
      after:      { id: product.id, name: product.name },
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
    return product;
  }

  // PATCH /admin/products/:id
  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Update product' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  async update(
    @Req() req: Request,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.update(id, dto);
    const userId = (req.user as { sub: string }).sub;
    this.auditLog.log({
      userId,
      action:     'UPDATE',
      entityType: 'Product',
      entityId:   id,
      after:      dto as unknown as Record<string, unknown>,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
    return product;
  }

  // DELETE /admin/products/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Soft-delete product (sets isActive=false)' })
  async delete(@Req() req: Request, @Param('id', ParseCuidPipe) id: string): Promise<void> {
    await this.productsService.delete(id);
    const userId = (req.user as { sub: string }).sub;
    this.auditLog.log({
      userId,
      action:     'DELETE',
      entityType: 'Product',
      entityId:   id,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
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

  // POST /admin/products/:id/images/from-urls
  @Post(':id/images/from-urls')
  @ApiOperation({ summary: '[Admin] Attach already-uploaded image URLs to a product' })
  @ApiResponse({ status: 201, type: [ProductImageResponseDto] })
  @HttpCode(HttpStatus.CREATED)
  attachImages(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: AttachImagesDto,
  ): Promise<ProductImageResponseDto[]> {
    return this.productsService.attachImageUrls(id, dto.urls);
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

  // ─── MongoDB detail endpoints ────────────────────────────────────────────────

  // GET /admin/products/:id/detail
  @Get(':id/detail')
  @ApiOperation({ summary: '[Admin] Get full MongoDB product detail (variants, attributes, customization)' })
  getProductDetail(@Param('id', ParseCuidPipe) id: string) {
    return this.productsService.getProductDetail(id);
  }

  // PUT /admin/products/:id/detail
  @Put(':id/detail')
  @ApiOperation({ summary: '[Admin] Upsert full MongoDB product detail' })
  @ApiResponse({ status: 200 })
  upsertProductDetail(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: CreateProductDetailDto,
  ) {
    // Force productId to match URL param
    dto.productId = id;
    return this.productsService.upsertProductDetail(id, dto);
  }

  // POST /admin/products/:id/variants
  @Post(':id/variants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Add a variant to the MongoDB detail' })
  addVariant(
    @Param('id', ParseCuidPipe) id: string,
    @Body() variant: VariantDto,
  ) {
    return this.productsService.addVariant(id, variant);
  }

  // DELETE /admin/products/:id/variants/:sku
  @Delete(':id/variants/:sku')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Remove a variant by SKU' })
  removeVariant(
    @Param('id', ParseCuidPipe) id: string,
    @Param('sku') sku: string,
  ) {
    return this.productsService.removeVariant(id, sku);
  }

  // POST /admin/products/:id/attributes
  @Post(':id/attributes')
  @ApiOperation({ summary: '[Admin] Replace all product attributes' })
  setAttributes(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: SetAttributesDto,
  ) {
    return this.productsService.setAttributes(id, dto.attributes);
  }

  // POST /admin/products/:id/customization
  @Post(':id/customization')
  @ApiOperation({ summary: '[Admin] Set/update the customization template' })
  setCustomization(
    @Param('id', ParseCuidPipe) id: string,
    @Body() customization: CustomizationTemplateDto,
  ) {
    return this.productsService.setCustomization(id, customization);
  }

  // ─── Variation Groups ─────────────────────────────────────────────────────

  @Get(':id/variations')
  @ApiOperation({ summary: '[Admin] List variation groups with options' })
  getVariationGroups(@Param('id', ParseCuidPipe) id: string) {
    return this.productsService.getVariationGroups(id);
  }

  @Put(':id/variations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Bulk-replace all variation groups' })
  bulkSaveVariations(@Param('id', ParseCuidPipe) id: string, @Body() dto: BulkSaveVariationsDto) {
    return this.productsService.bulkSaveVariations(id, dto.groups as Parameters<typeof this.productsService.bulkSaveVariations>[1]);
  }

  @Get(':id/variations/:groupId')
  @ApiOperation({ summary: '[Admin] Get single variation group' })
  getVariationGroup(
    @Param('id', ParseCuidPipe) id: string,
    @Param('groupId') groupId: string,
  ) {
    return this.productsService.getVariationGroup(id, groupId);
  }

  @Post(':id/variations/groups')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create a new variation group' })
  createVariationGroup(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: VariationGroupCreateDto,
  ) {
    return this.productsService.createVariationGroup(id, dto as Parameters<typeof this.productsService.createVariationGroup>[1]);
  }

  @Delete(':id/variations/groups/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete variation group (cascades options)' })
  deleteVariationGroup(
    @Param('id', ParseCuidPipe) id: string,
    @Param('groupId') groupId: string,
  ) {
    return this.productsService.deleteVariationGroup(id, groupId);
  }

  // ─── Variation Options ────────────────────────────────────────────────────

  @Post(':id/variations/:groupId/options')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Add option to a variation group' })
  addVariationOption(
    @Param('id', ParseCuidPipe) id: string,
    @Param('groupId') groupId: string,
    @Body() dto: VariationOptionCreateDto,
  ) {
    return this.productsService.addVariationOptionToGroup(id, groupId, dto);
  }

  @Patch(':id/variations/:groupId/options/:optionId')
  @ApiOperation({ summary: '[Admin] Update a variation option' })
  updateVariationOption(
    @Param('id', ParseCuidPipe) id: string,
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
    @Body() dto: VariationOptionPatchDto,
  ) {
    return this.productsService.updateVariationOption(id, groupId, optionId, dto);
  }

  @Delete(':id/variations/:groupId/options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a variation option' })
  deleteVariationOption(
    @Param('id', ParseCuidPipe) id: string,
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.productsService.deleteVariationOption(id, groupId, optionId);
  }

  // ─── Variation Settings ───────────────────────────────────────────────────

  @Get(':id/variation-settings')
  @ApiOperation({ summary: '[Admin] Get variation settings for a product' })
  getVariationSettings(@Param('id', ParseCuidPipe) id: string) {
    return this.productsService.getVariationSettings(id);
  }

  @Patch(':id/variation-settings')
  @ApiOperation({ summary: '[Admin] Update variation settings' })
  updateVariationSettings(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: VariationSettingsDto,
  ) {
    return this.productsService.upsertVariationSettings(id, dto);
  }

  // ─── Flat Variants (for price matrix) ────────────────────────────────────

  @Get(':id/variations/variants')
  @ApiOperation({ summary: '[Admin] List flat ProductVariant rows (for price matrix)' })
  getVariants(@Param('id', ParseCuidPipe) id: string) {
    return this.productsService.getVariants(id);
  }

  @Patch(':id/variations/variants/:variantId')
  @ApiOperation({ summary: '[Admin] Update a variant (price / compareAt / sku)' })
  updateVariant(
    @Param('id', ParseCuidPipe) id: string,
    @Param('variantId') variantId: string,
    @Body() dto: VariantPatchDto,
  ) {
    return this.productsService.updateVariantById(id, variantId, dto);
  }

  // ─── Custom Options ───────────────────────────────────────────────────────

  @Get(':id/custom-options')
  @ApiOperation({ summary: '[Admin] List custom order options (from MongoDB)' })
  getCustomOptions(@Param('id', ParseCuidPipe) id: string) {
    return this.productsService.getCustomOptions(id);
  }

  @Post(':id/custom-options')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Add a custom option field' })
  createCustomOption(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: CustomOptionCreateDto,
  ) {
    return this.productsService.createCustomOption(id, dto);
  }

  @Patch(':id/custom-options/:optionId')
  @ApiOperation({ summary: '[Admin] Update a custom option field' })
  updateCustomOption(
    @Param('id', ParseCuidPipe) id: string,
    @Param('optionId') optionId: string,
    @Body() dto: CustomOptionCreateDto,
  ) {
    return this.productsService.updateCustomOption(id, optionId, dto as unknown as Record<string, unknown>);
  }

  @Delete(':id/custom-options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a custom option field' })
  deleteCustomOption(
    @Param('id', ParseCuidPipe) id: string,
    @Param('optionId') optionId: string,
  ) {
    return this.productsService.deleteCustomOption(id, optionId);
  }

  @Put(':id/custom-options/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Reorder custom option fields' })
  reorderCustomOptions(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: ReorderIdsDto,
  ) {
    return this.productsService.reorderCustomOptions(id, dto.orderedIds);
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────────

  // PATCH /admin/products/bulk
  @Patch('bulk')
  @ApiOperation({ summary: '[Admin] Bulk update products (publish/unpublish/archive/set-sale)' })
  async bulkUpdate(@Req() req: Request, @Body() dto: BulkProductActionDto) {
    if (!dto.ids || dto.ids.length === 0) throw new BadRequestException('No products selected');
    if (dto.ids.length > 200) throw new BadRequestException('Max 200 products per bulk action');

    let result: Record<string, unknown>;

    switch (dto.action) {
      case 'publish':
        await this.prisma.product.updateMany({
          where: { id: { in: dto.ids } },
          data:  { status: ProductStatus.ACTIVE, isActive: true },
        });
        result = { updated: dto.ids.length, action: 'published' };
        break;

      case 'unpublish':
        await this.prisma.product.updateMany({
          where: { id: { in: dto.ids } },
          data:  { status: ProductStatus.INACTIVE, isActive: false },
        });
        result = { updated: dto.ids.length, action: 'unpublished' };
        break;

      case 'archive':
        await this.prisma.product.updateMany({
          where: { id: { in: dto.ids } },
          data:  { status: ProductStatus.ARCHIVED, isActive: false },
        });
        result = { updated: dto.ids.length, action: 'archived' };
        break;

      case 'set-sale': {
        const pct = Number(dto.payload?.['discountPercent'] ?? 0);
        if (pct <= 0 || pct >= 100) throw new BadRequestException('Discount must be 1–99%');
        const products = await this.prisma.product.findMany({
          where:  { id: { in: dto.ids } },
          select: { id: true, basePrice: true },
        });
        await this.prisma.$transaction(
          products.map((p) => {
            const salePrice = Math.round(Number(p.basePrice) * (1 - pct / 100) * 100) / 100;
            return this.prisma.product.update({
              where: { id: p.id },
              data:  { compareAtPrice: p.basePrice, basePrice: salePrice },
            });
          }),
        );
        result = { updated: dto.ids.length, action: 'sale-applied', discountPercent: pct };
        break;
      }

      default:
        throw new BadRequestException(`Unknown action: ${dto.action}`);
    }

    const userId = (req.user as { sub: string }).sub;
    this.auditLog.log({
      userId,
      action:     'BULK_UPDATE',
      entityType: 'Product',
      entityId:   dto.ids[0] ?? 'bulk',
      after:      { ids: dto.ids, ...result },
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });

    return result;
  }

  // PATCH /admin/products/:id/related
  @Patch(':id/related')
  @ApiOperation({ summary: '[Admin] Set up to 4 manually pinned related products' })
  async updateRelated(
    @Param('id') id: string,
    @Body() body: { ids: string[] },
  ) {
    const ids = (body.ids ?? []).slice(0, 4);
    return this.prisma.product.update({
      where: { id },
      data:  { featuredRelatedIds: ids },
      select: { id: true, featuredRelatedIds: true },
    });
  }

  // POST /admin/products/export
  @Post('export')
  @ApiOperation({ summary: '[Admin] Export products to CSV' })
  async exportCsv(@Body() dto: BulkExportDto, @Res() res: Response): Promise<void> {
    const products = await this.prisma.product.findMany({
      where:   dto.ids?.length ? { id: { in: dto.ids } } : {},
      include: {
        category: { select: { slug: true } },
        tags:     { include: { tag: { select: { name: true } } } },
        images:   { where: { isPrimary: true }, take: 1 },
        variationGroups: { include: { options: true }, take: 2 },
      },
      orderBy: { createdAt: 'desc' },
      take:    2000,
    });

    const header = [
      'name','slug','description','shortDescription','basePrice','compareAtPrice',
      'status','categorySlug','tags','collectionSlugs','isPersonalizable','isFeatured',
      'processingDays','variationGroupName','variationGroupType','variationOptions','images',
    ].join(',');

    const rows = products.map((p) => {
      const variation = p.variationGroups[0];
      const variationOptions = variation?.options
        .map((o) => `${o.name}:${Number(o.priceDelta ?? 0)}`)
        .join('|') ?? '';
      return [
        p.name,
        p.slug,
        p.description?.replace(/"/g, '""') ?? '',
        p.shortDescription?.replace(/"/g, '""') ?? '',
        Number(p.basePrice),
        p.compareAtPrice != null ? Number(p.compareAtPrice) : '',
        p.status,
        p.category?.slug ?? '',
        p.tags.map((pt) => pt.tag.name).join(','),
        '',
        p.isPersonalizable,
        p.isFeatured,
        p.processingDays,
        variation?.name ?? '',
        variation?.displayType ?? '',
        variationOptions,
        p.images[0]?.url ?? '',
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products-export-${Date.now()}.csv"`);
    res.send(csv);
  }
}
