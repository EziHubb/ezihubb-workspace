import {
  Controller,
  Get,
  Post,
  Put,
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
    return this.productsService.findAll(Object.assign({}, query, { includeInactive: true }) as any);
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
}
