import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Catalog')
@Public()
@Controller('catalog')
export class CategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  // GET /catalog/mega-menu
  @Get('mega-menu')
  @ApiOperation({ summary: 'Full mega-menu structure for the navbar (MongoDB, Redis-cached 10 min)' })
  getMegaMenu() {
    return this.catalogService.getMegaMenu();
  }

  // GET /catalog/categories
  @Get('categories')
  @ApiOperation({ summary: 'Get category tree (root + children, visible only)' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  getCategories(): Promise<CategoryResponseDto[]> {
    return this.catalogService.getCategories();
  }

  // GET /catalog/categories/:slug
  @Get('categories/:slug')
  @ApiOperation({ summary: 'Get category by slug with L2/L3 children and product count' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  getCategoryBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.catalogService.getCategoryBySlug(slug);
  }

  // GET /catalog/tags — (kept for backward compat, also exposed on collections controller)
  @Get('tags')
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
