import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';

@ApiTags('Admin — Catalog')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ─── Mega menu sync ─────────────────────────────────────────────────────────

  // POST /admin/catalog/sync-mega-menu
  @Post('catalog/sync-mega-menu')
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

  // POST /admin/categories
  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create category' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  createCategory(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.catalogService.createCategory(dto);
  }

  // PATCH /admin/categories/:id
  @Patch('categories/:id')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete category (rejected if has active products)' })
  deleteCategory(@Param('id', ParseCuidPipe) id: string): Promise<void> {
    return this.catalogService.deleteCategory(id);
  }

  // ─── Collections ────────────────────────────────────────────────────────────

  // GET /admin/collections
  @Get('collections')
  @ApiOperation({ summary: '[Admin] List all collections (including inactive)' })
  @ApiResponse({ status: 200, type: [CollectionResponseDto] })
  getCollections(): Promise<CollectionResponseDto[]> {
    return this.catalogService.getCollections({});
  }

  // POST /admin/collections
  @Post('collections')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create collection' })
  @ApiResponse({ status: 201, type: CollectionResponseDto })
  createCollection(@Body() dto: CreateCollectionDto): Promise<CollectionResponseDto> {
    return this.catalogService.createCollection(dto);
  }

  // PATCH /admin/collections/:id
  @Patch('collections/:id')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete collection' })
  deleteCollection(@Param('id', ParseCuidPipe) id: string): Promise<void> {
    return this.catalogService.deleteCollection(id);
  }
}
