import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Catalog')
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  // GET /categories
  @Get()
  @ApiOperation({ summary: 'Get category tree (root + children, visible only)' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  getCategories(): Promise<CategoryResponseDto[]> {
    return this.catalogService.getCategories();
  }

  // GET /categories/:slug
  @Get(':slug')
  @ApiOperation({ summary: 'Get category by slug with product count' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  getCategoryBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.catalogService.getCategoryBySlug(slug);
  }
}
