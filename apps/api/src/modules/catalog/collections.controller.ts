import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CollectionResponseDto, TagResponseDto } from './dto/collection-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TranslatableResponse } from '../../common/interceptors/i18n.interceptor';
import { Locale } from '../../common/decorators/locale.decorator';
import type { SupportedLocale } from '../../common/utils/locale.util';

@ApiTags('Catalog')
@Public()
@Controller()
export class CollectionsController {
  constructor(private readonly catalogService: CatalogService) {}

  // GET /collections
  @Get('collections')
  @TranslatableResponse('Collection')
  @ApiOperation({ summary: 'Get active collections within their date range' })
  @ApiResponse({ status: 200, type: [CollectionResponseDto] })
  @ApiQuery({ name: 'occasion', required: false })
  getCollections(@Query('occasion') occasion?: string): Promise<CollectionResponseDto[]> {
    return this.catalogService.getCollections({ isActive: true, occasion });
  }

  // GET /collections/:slug
  // Note: not @TranslatableResponse — the response nests nested `products[]` (each a
  // Product), which the generic interceptor can't reach. CatalogService applies both
  // the Collection's own translation AND its nested products' translations manually.
  @Get('collections/:slug')
  @ApiOperation({ summary: 'Get collection by slug with paginated products' })
  getCollectionBySlug(
    @Param('slug') slug: string,
    @Query() pagination: PaginationDto,
    @Locale() locale: SupportedLocale,
  ) {
    return this.catalogService.getCollectionBySlug(slug, pagination, locale);
  }

  // GET /tags
  @Get('tags')
  @TranslatableResponse('Tag')
  @ApiOperation({ summary: 'Get all tags with product counts' })
  @ApiResponse({ status: 200, type: [TagResponseDto] })
  getAllTags(): Promise<TagResponseDto[]> {
    return this.catalogService.getAllTags();
  }
}
