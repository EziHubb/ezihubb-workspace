import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { TranslatableResponse } from '../../common/interceptors/i18n.interceptor';
import { Locale } from '../../common/decorators/locale.decorator';
import type { SupportedLocale } from '../../common/utils/locale.util';

@ApiTags('Catalog')
@Public()
@Controller('catalog')
export class CategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  // GET /catalog/mega-menu
  // Note: not @TranslatableResponse — 3-level nested tree with non-uniform field
  // names (navLabel/title/name); CatalogService applies translations manually.
  @Get('mega-menu')
  @ApiOperation({ summary: 'Full mega-menu structure for the navbar (MongoDB, Redis-cached 10 min)' })
  getMegaMenu(@Locale() locale: SupportedLocale) {
    return this.catalogService.getMegaMenu(locale);
  }

  // GET /catalog/categories
  // Note: not @TranslatableResponse — nested children/grandchildren; handled manually.
  @Get('categories')
  @ApiOperation({ summary: 'Get category tree (root + children, visible only)' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  getCategories(@Locale() locale: SupportedLocale): Promise<CategoryResponseDto[]> {
    return this.catalogService.getCategories(locale);
  }

  // GET /catalog/categories/:slug
  @Get('categories/:slug')
  @ApiOperation({ summary: 'Get category by slug with L2/L3 children and product count' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  getCategoryBySlug(
    @Param('slug') slug: string,
    @Locale() locale: SupportedLocale,
  ): Promise<CategoryResponseDto> {
    return this.catalogService.getCategoryBySlug(slug, locale);
  }

  // GET /catalog/tags — (kept for backward compat, also exposed on collections controller)
  @Get('tags')
  @TranslatableResponse('Tag')
  @ApiOperation({ summary: 'All active tags' })
  getAllTags() {
    return this.catalogService.getAllTags();
  }

  // GET /catalog/categories/:slug/filterable-attributes
  @Get('categories/:slug/filterable-attributes')
  @ApiOperation({
    summary: 'Get unique filterable attributes for products in a category',
    description: 'Used by FilterSidebar to show category-specific attribute filters (e.g. Material, Size).',
  })
  getFilterableAttributes(@Param('slug') slug: string) {
    return this.catalogService.getFilterableAttributes(slug);
  }
}
