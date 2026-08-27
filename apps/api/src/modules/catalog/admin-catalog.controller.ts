import {
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { AdminCollectionQueryDto } from './dto/admin-collection-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';

@AdminController('')
export class AdminCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ─── Mega menu sync ─────────────────────────────────────────────────────────

  // POST /admin/catalog/sync-mega-menu
  @Post('catalog/sync-mega-menu')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Rebuild MongoDB mega-menu from Prisma categories' })
  syncMegaMenu(): Promise<{ synced: number }> {
    return this.catalogService.syncMegaMenu();
  }

  // ─── Categories ─────────────────────────────────────────────────────────────

  // GET /admin/categories
  @Get('categories')
  @ApiOperation({ summary: '[Admin] List all categories (flat, including hidden)' })
  getAdminCategories(@Query('limit') limit?: string): Promise<CategoryResponseDto[]> {
    return this.catalogService.getAdminCategories(limit ? Math.min(Number(limit), 2000) : 500);
  }

  // GET /admin/categories/:id
  @Get('categories/:id')
  @ApiOperation({ summary: '[Admin] Get single category by ID' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  getAdminCategory(@Param('id', ParseCuidPipe) id: string): Promise<CategoryResponseDto> {
    return this.catalogService.getAdminCategoryById(id);
  }

  // POST /admin/categories
  @Post('categories')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create category' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  createCategory(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.catalogService.createCategory(dto);
  }

  // PATCH /admin/categories/:id
  @Patch('categories/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Update category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  updateCategory(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.catalogService.updateCategory(id, dto);
  }

  // DELETE /admin/categories/:id
  @Delete('categories/:id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete category (rejected if has active products)' })
  deleteCategory(@Param('id', ParseCuidPipe) id: string): Promise<void> {
    return this.catalogService.deleteCategory(id);
  }

  // ─── Collections ────────────────────────────────────────────────────────────

  // GET /admin/collections
  @Get('collections')
  @ApiOperation({
    summary:
      '[Admin] List collections — paginated, searchable, and including ones ' +
      'outside their live window',
  })
  getCollections(@Query() query: AdminCollectionQueryDto) {
    return this.catalogService.getCollectionsAdmin({
      page:     query.page,
      limit:    query.limit,
      q:        query.q,
      occasion: query.occasion,
      isActive: query.isActive,
    });
  }

  // POST /admin/collections
  @Post('collections')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create collection' })
  @ApiResponse({ status: 201, type: CollectionResponseDto })
  createCollection(@Body() dto: CreateCollectionDto): Promise<CollectionResponseDto> {
    return this.catalogService.createCollection(dto);
  }

  // POST /admin/collections/banner
  //
  // Before the :id routes below, and it has to stay there: this and
  // 'collections/:id' are both two segments, and Nest matches in declaration
  // order, so a later position would make 'banner' look like an id.
  @Post('collections/banner')
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: '[Admin] Upload a collection banner and return its URL' })
  async uploadCollectionBanner(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ code: 'ERR_FILE_REQUIRED', message: 'file is required' });
    }
    return this.catalogService.uploadCollectionBanner(file);
  }

  // PATCH /admin/collections/:id
  @Patch('collections/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Update collection' })
  @ApiResponse({ status: 200, type: CollectionResponseDto })
  updateCollection(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<CollectionResponseDto> {
    return this.catalogService.updateCollection(id, dto);
  }

  // DELETE /admin/collections/:id
  @Delete('collections/:id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete collection' })
  deleteCollection(@Param('id', ParseCuidPipe) id: string): Promise<void> {
    return this.catalogService.deleteCollection(id);
  }
}
