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
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { TitleSuggestionService } from './title-suggestion.service';
import { TitleSuggestionRequestDto, TitleSuggestionResponseDto } from './dto/title-suggestion.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductStatus, PrintSide } from '@prisma/client';
import { RequireArchivedGuard } from './guards/require-archived.guard';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductImageResponseDto, DigitalFileResponseDto, ProductVideoDto } from './dto/product-response.dto';
import { ProductListItemDto } from './dto/product-list-item.dto';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { AuditLogService } from '../../common/services/audit-log.service';
import { StoreContextService } from '../../common/services/store-context.service';
import { ProductOwnershipGuard } from '../../common/guards/product-ownership.guard';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import {
  IsArray, IsString, ArrayMaxSize, IsOptional, IsBoolean,
  IsNumber, IsEnum, MaxLength, ValidateNested, IsIn, IsObject, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreateProductDetailDto,
  VariantDto,
  AttributeDto,
  CustomizationTemplateDto,
  SetAttributesDto,
} from './dto/create-product-detail.dto';
import { ReorderImagesDto, AttachImagesDto, DeleteVideoDto, GeneratePrintFileDto, ApprovePrintFileDto, AttachPrintFileDto, UploadDigitalFilesDto, ReorderDigitalFilesDto , AttachVideoDto } from './dto/product-image.dto';

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

// Length caps mirror VariationOptionCreateDto above — PATCH was looser than
// CREATE for the same three columns, so a value rejected on create could be
// slipped in via an edit.
class VariationOptionPatchDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) value?: string;
  @IsOptional() @IsString() @MaxLength(20)  colorHex?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imageId?: string;
  @IsOptional() @IsNumber() priceDelta?: number;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

// price/quantity were @IsNumber only — a negative price flowed straight into
// ProductVariant and then into storefront price / cart-total math as a
// negative line item; a negative quantity broke the
// `available = quantity - reserved` stock assumption.
class VariantPatchDto {
  @IsOptional() @IsNumber() @Min(0) price?: number | null;
  @IsOptional() @IsNumber() @Min(0) quantity?: number | null;
  @IsOptional() @IsString() sku?: string | null;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

// ── Apply variations (single commit for the whole "Manage variations" modal) ──

class ApplyVariationOptionDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(100) value?: string;
  @IsOptional() @IsString() @MaxLength(20) colorHex?: string;
  // Preserved through Apply's replace-the-whole-tree cycle — set separately
  // by VariantImagePicker's own immediate PATCH, not edited in this modal.
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsString() imageId?: string | null;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsNumber() sortOrder?: number;
}

class ApplyVariationGroupDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() displayType?: string;
  @IsNumber() sortOrder: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ApplyVariationOptionDto)
  options: ApplyVariationOptionDto[];
}

class VariantEditDto {
  // Keyed by options, not id — a brand-new combination the seller priced in
  // the grid before Apply has no ProductVariant.id yet.
  @IsObject() options: Record<string, string>;
  // Same @Min(0) reasoning as VariantPatchDto — these reach the same
  // ProductVariant columns through the second (Apply) route.
  @IsOptional() @IsNumber() @Min(0) price?: number | null;
  @IsOptional() @IsNumber() @Min(0) quantity?: number | null;
  @IsOptional() @IsString() sku?: string | null;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

class ApplyVariationsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ApplyVariationGroupDto)
  groups: ApplyVariationGroupDto[];

  @IsArray() @IsString({ each: true })
  variesBy: string[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VariantEditDto)
  variantEdits?: VariantEditDto[];

  // Which group's options carry linked photos, or null for none. Sent on every
  // Apply, including as null — omitting it has to keep the stored value, which
  // is why "off" is an explicit null rather than a missing field.
  @IsOptional() @IsString() photoGroupId?: string | null;
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
  @IsIn(['publish', 'unpublish', 'archive', 'set-sale', 'edit-tags', 'edit-title']) action: string;
  @IsOptional() payload?: Record<string, unknown>;
}

class BulkExportDto {
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(2000) ids?: string[];
}

// Order matters: NestJS merges class-level @UseGuards() calls in the order
// the decorators execute (bottom-up), so ProductOwnershipGuard must be
// declared ABOVE @AdminController — otherwise it runs before JwtAuthGuard
// populates req.user, and every request (even a SUPER_ADMIN's) 403s with
// "Not authenticated" before RolesGuard/JwtAuthGuard ever get to run.
@UseGuards(ProductOwnershipGuard)
@AdminController('products')
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly storeContext: StoreContextService,
    private readonly titleSuggestion: TitleSuggestionService,
  ) {}

  // POST /admin/products/title-suggestion — stateless (no id needed, works in create mode
  // too), must be declared before :id routes. Throttled since each call is a real LLM cost.
  @Post('title-suggestion')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] AI-suggested SEO-friendly title from the current name/description/category' })
  async suggestTitle(@Body() dto: TitleSuggestionRequestDto): Promise<TitleSuggestionResponseDto> {
    const suggestedTitle = await this.titleSuggestion.suggest(dto.name, dto.description, dto.categoryName);
    return { suggestedTitle };
  }

  // GET /admin/products/stats — must be declared before :id routes
  @Get('stats')
  @ApiOperation({ summary: '[Admin] Product status counts for sidebar' })
  async getStats(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    return this.productsService.getStats(context.storeId ?? undefined);
  }

  // GET /admin/products/seo-stats — declared before :id routes. Has no :id
  // param, so ProductOwnershipGuard no-ops on it (see the guard's own
  // doc comment: "No-ops for routes with no product id param") — this route
  // must scope itself, the same way `stats` above does. Previously didn't,
  // returning platform-wide counts to any ADMIN (found via a real
  // route-by-route audit of every non-:id route on this controller and
  // ShopStatsController, the only other consumer of this guard — this was
  // the only gap found, not a wider pattern).
  @Get('seo-stats')
  @ApiOperation({ summary: '[Admin] SEO health stats (scoped to own store for shop owners)' })
  async getSeoStats(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = context.storeId ?? undefined;
    const [total, withDescription, withImages, withName] = await Promise.all([
      this.prisma.product.count({ where: { deletedAt: null, storeId } }),
      this.prisma.product.count({ where: { deletedAt: null, storeId, description: { not: '' } } }),
      this.prisma.product.count({ where: { deletedAt: null, storeId, images: { some: {} } } }),
      this.prisma.product.count({ where: { deletedAt: null, storeId, name: { not: '' } } }),
    ]);
    return {
      total,
      withDescription,
      missingDescription: total - withDescription,
      withImages,
      missingImages: total - withImages,
      withName,
      seoScore: total > 0 ? Math.round(((withDescription + withImages + withName) / (total * 3)) * 100) : 0,
    };
  }

  // GET /admin/products
  @Get()
  @ApiOperation({ summary: '[Admin] List products (includes inactive, scoped to own store for shop owners)' })
  async findAll(@Req() req: Request, @Query() query: ProductQueryDto): Promise<PaginatedResult<ProductListItemDto>> {
    const context = await this.storeContext.resolve(req);
    return this.productsService.findAll(Object.assign({}, query, { includeInactive: true }, context.storeId ? { storeId: context.storeId } : {}) as any);
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
  async createDraft(@Req() req: Request): Promise<ProductResponseDto> {
    const context = await this.storeContext.resolve(req);
    // Without this, every draft (and therefore every product created through
    // the shared admin UI) was silently created with storeId=null — orphaned
    // from the creating shop owner's store, and immediately inaccessible to
    // them once ProductOwnershipGuard started enforcing ownership.
    return context.storeId
      ? this.productsService.createDraftForStore(context.storeId)
      : this.productsService.createDraft();
  }

  // POST /admin/products
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create product with variants' })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  async create(@Req() req: Request, @Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const context = await this.storeContext.resolve(req);
    const product = await this.productsService.create(dto, context.storeId ?? undefined);
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

  // PATCH /admin/products/bulk — must be declared BEFORE :id to avoid route conflict
  @Patch('bulk')
  @ApiOperation({ summary: '[Admin] Bulk update products (publish/unpublish/archive/set-sale)' })
  async bulkUpdate(@Req() req: Request, @Body() dto: BulkProductActionDto) {
    if (!dto.ids || dto.ids.length === 0) throw new BadRequestException('No products selected');
    if (dto.ids.length > 200) throw new BadRequestException('Max 200 products per bulk action');

    // Silently drop any id the caller doesn't own — prevents a scoped store
    // owner from bulk-publishing/archiving/pricing another store's products
    // by passing arbitrary ids in the body (ProductOwnershipGuard only checks
    // a single :id route param, not an array inside the body).
    const context = await this.storeContext.resolve(req);
    if (!context.isPlatformContext) {
      const owned = await this.prisma.product.findMany({
        where: { id: { in: dto.ids }, storeId: context.storeId },
        select: { id: true },
      });
      dto.ids = owned.map((p) => p.id);
      if (dto.ids.length === 0) throw new BadRequestException('No products selected');
    }

    let result: Record<string, unknown>;

    switch (dto.action) {
      case 'publish': {
        // Delegates to the service so publishing bills identically here and on
        // the seller's PATCH /:id/status. It runs the listing-fee ledger rows
        // and the status flip inside one transaction: if any part fails,
        // nothing in the batch is published and nothing is billed. Listings
        // already charged (republished, or billed under the old create-time
        // behaviour) are skipped by productId. See docs/listing-fee.md.
        const { published, charged } = await this.productsService.publishProducts(dto.ids);
        result = { updated: published, charged, action: 'published' };
        break;
      }

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

      case 'edit-tags': {
        const mode = dto.payload?.['mode'] === 'remove' ? 'remove' : 'add';
        const tag  = String(dto.payload?.['tag'] ?? '');
        if (!tag.trim()) throw new BadRequestException('Tag is required');
        await this.productsService.bulkEditTags(dto.ids, mode, tag);
        result = { updated: dto.ids.length, action: mode === 'add' ? 'tag-added' : 'tag-removed' };
        break;
      }

      case 'edit-title': {
        const mode = String(dto.payload?.['mode'] ?? '') as 'add-front' | 'add-end' | 'find-replace' | 'delete';
        if (!['add-front', 'add-end', 'find-replace', 'delete'].includes(mode)) {
          throw new BadRequestException('Invalid title-edit mode');
        }
        const text     = String(dto.payload?.['text'] ?? '');
        const findText = dto.payload?.['findText'] !== undefined ? String(dto.payload['findText']) : undefined;
        if (mode !== 'find-replace' && !text.trim()) throw new BadRequestException('Text is required');
        if (mode === 'find-replace' && !findText?.trim()) throw new BadRequestException('Text to find is required');
        await this.productsService.bulkEditTitle(dto.ids, mode, text, findText);
        result = { updated: dto.ids.length, action: 'title-edited' };
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
  @UseGuards(RequireArchivedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Permanently delete a product — must already be Archived' })
  async delete(@Req() req: Request, @Param('id', ParseCuidPipe) id: string): Promise<void> {
    const deleted = await this.productsService.delete(id);
    const userId = (req.user as { sub: string }).sub;
    this.auditLog.log({
      userId,
      action:     'DELETE',
      entityType: 'Product',
      entityId:   id,
      before:     deleted,
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

  // ─── Print files (isolated design artwork for POD fulfillment) ───────────

  // POST /admin/products/:id/print-files/generate
  @Post(':id/print-files/generate')
  @ApiOperation({ summary: '[Admin] Generate a print file by removing the background from one of this product\'s own mockup photos' })
  generatePrintFile(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: GeneratePrintFileDto,
  ): Promise<{ jobId: string }> {
    return this.productsService.generatePrintFileFromImage(id, dto.sourceImageId, dto.printSide);
  }

  // GET /admin/products/:id/print-files/generate/:jobId
  @Get(':id/print-files/generate/:jobId')
  @ApiOperation({ summary: '[Admin] Poll a print-file generation job' })
  getPrintFileJobStatus(@Param('jobId') jobId: string) {
    return this.productsService.getPrintFileJobStatus(jobId);
  }

  // POST /admin/products/:id/print-files/:printSide/approve
  @Post(':id/print-files/:printSide/approve')
  @ApiOperation({ summary: '[Admin] Approve a generated print-file preview, saving it as the active print file for that side' })
  approvePrintFile(
    @Param('id', ParseCuidPipe) id: string,
    @Param('printSide') printSide: PrintSide,
    @Body() dto: ApprovePrintFileDto,
  ): Promise<ProductImageResponseDto> {
    return this.productsService.approvePrintFile(id, dto.processedKey, printSide);
  }

  // POST /admin/products/:id/print-files — manual upload/replace fallback
  @Post(':id/print-files')
  @ApiOperation({ summary: '[Admin] Manually attach a real print file (for sellers who already have one)' })
  attachPrintFile(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: AttachPrintFileDto,
  ): Promise<ProductImageResponseDto> {
    return this.productsService.attachPrintFile(id, dto.url, dto.printSide);
  }

  // DELETE /admin/products/:id/print-files/:printSide
  @Delete(':id/print-files/:printSide')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Remove the print file for one side' })
  deletePrintFile(
    @Param('id', ParseCuidPipe) id: string,
    @Param('printSide') printSide: PrintSide,
  ): Promise<void> {
    return this.productsService.deletePrintFile(id, printSide);
  }

  // ─── Digital files (the sold deliverable for DIGITAL products) ───────────

  // POST /admin/products/:id/digital-files
  @Post(':id/digital-files')
  @UseInterceptors(FilesInterceptor('files', 20, { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } }, variantId: { type: 'string' } } } })
  @ApiOperation({ summary: '[Admin] Upload digital deliverable files (max 50 MB each, up to 20 at once)' })
  @ApiResponse({ status: 201, type: [DigitalFileResponseDto] })
  @HttpCode(HttpStatus.CREATED)
  uploadDigitalFiles(
    @Param('id', ParseCuidPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadDigitalFilesDto,
  ): Promise<DigitalFileResponseDto[]> {
    return this.productsService.uploadDigitalFiles(id, files, dto.variantId);
  }

  // DELETE /admin/products/:id/digital-files/:fileId
  @Delete(':id/digital-files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a digital deliverable file. Returns 409 ERR_HAS_PURCHASES if buyers already own it — pass ?force=true to delete anyway.' })
  deleteDigitalFile(
    @Param('id', ParseCuidPipe) id: string,
    @Param('fileId', ParseCuidPipe) fileId: string,
    @Query('force') force?: string,
  ): Promise<void> {
    return this.productsService.deleteDigitalFile(id, fileId, { force: force === 'true' });
  }

  // PATCH /admin/products/:id/digital-files/reorder
  @Patch(':id/digital-files/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Reorder digital deliverable files' })
  reorderDigitalFiles(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: ReorderDigitalFilesDto,
  ): Promise<void> {
    return this.productsService.reorderDigitalFiles(id, dto.orderedIds);
  }

  // POST /admin/products/:id/videos
  @Post(':id/videos')
  @UseInterceptors(FileInterceptor('video', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { video: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: '[Admin] Upload a product video (MP4/WebM/MOV, max 10s, max 20 MB, max 2 per product)' })
  @HttpCode(HttpStatus.CREATED)
  uploadVideo(
    @Param('id', ParseCuidPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string; videoUrls: string[]; video: ProductVideoDto }> {
    return this.productsService.uploadVideo(id, file);
  }

  // POST /admin/products/:id/videos/from-url
  @Post(':id/videos/from-url')
  @ApiOperation({ summary: '[Admin] Attach an already-hosted video by URL (no upload). Host must be allowlisted server-side.' })
  @ApiResponse({ status: 201, type: ProductVideoDto })
  @HttpCode(HttpStatus.CREATED)
  attachVideo(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: AttachVideoDto,
  ): Promise<ProductVideoDto> {
    return this.productsService.attachVideoFromUrl(id, dto);
  }

  // DELETE /admin/products/:id/videos
  @Delete(':id/videos')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a product video' })
  deleteVideo(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: DeleteVideoDto,
  ): Promise<void> {
    return this.productsService.deleteVideo(id, dto.url);
  }

  // ─── MongoDB detail endpoints ────────────────────────────────────────────────

  // GET /admin/products/:id/detail
  @Get(':id/detail')
  @ApiOperation({ summary: '[Admin] Get full MongoDB product detail (variants, attributes, customization)' })
  getProductDetail(@Param('id', ParseCuidPipe) id: string) {
    return this.productsService.getProductDetail(id);
  }

  // PUT|PATCH /admin/products/:id/detail
  //
  // Both verbs, one handler. The service $sets only the fields present in the
  // body, so this has always behaved as a partial update whatever it was
  // called — and GPSRModal was already calling PATCH against a PUT-only route,
  // which meant saving GPSR information silently did nothing.
  //
  // No `dto.productId = id` here any more: the service queries by the `id`
  // parameter and never read that field, and assigning it after the fact could
  // not have satisfied validation anyway — the pipe runs first.
  // Two handlers, not one method carrying both decorators. Stacking @Put and
  // @Patch looks like it should work and silently does not: Nest reads a
  // single METHOD_METADATA per handler, decorators apply bottom-up, and the
  // upper one wins — so PATCH went on answering 404 while PUT worked. Caught
  // by probing the deployed route rather than by the type-checker, which has
  // nothing to say about it.
  @Put(':id/detail')
  @ApiOperation({ summary: '[Admin] Upsert MongoDB product detail (partial — only fields present are written)' })
  @ApiResponse({ status: 200 })
  upsertProductDetail(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: CreateProductDetailDto,
  ) {
    return this.productsService.upsertProductDetail(id, dto);
  }

  @Patch(':id/detail')
  @ApiOperation({ summary: '[Admin] Same as PUT — GPSRModal and other partial savers use PATCH' })
  @ApiResponse({ status: 200 })
  patchProductDetail(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: CreateProductDetailDto,
  ) {
    return this.upsertProductDetail(id, dto);
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

  // POST /admin/products/:id/variations/apply — single commit for the whole
  // "Manage variations" modal (groups + options + variesBy settings + any
  // direct per-variant price/quantity/sku/visible edits from the combo
  // grid), reconciled in one transaction. Declared before :groupId routes.
  @Post(':id/variations/apply')
  @ApiOperation({ summary: '[Admin] Apply all pending Manage Variations changes in one commit' })
  applyVariations(@Param('id', ParseCuidPipe) id: string, @Body() dto: ApplyVariationsDto) {
    return this.productsService.applyVariations(id, dto);
  }

  // ─── Flat Variants (for price matrix) ────────────────────────────────────
  // Declared BEFORE ':id/variations/:groupId' below — Nest/Express matches
  // routes in registration order, so a literal segment ("variants") must be
  // registered ahead of a wildcard param (":groupId") on the same prefix, or
  // every call here gets swallowed by getVariationGroup(id, "variants")
  // instead (returns null, not the flat array the frontend expects).
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
  @ApiOperation({ summary: '[Admin] Export products to CSV (scoped to own store for shop owners)' })
  async exportCsv(@Req() req: Request, @Body() dto: BulkExportDto, @Res() res: Response): Promise<void> {
    const context = await this.storeContext.resolve(req);
    const storeFilter = context.isPlatformContext ? {} : { storeId: context.storeId };
    const products = await this.prisma.product.findMany({
      where:   { ...storeFilter, ...(dto.ids?.length ? { id: { in: dto.ids } } : {}) },
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
