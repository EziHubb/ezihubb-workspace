import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CollectionResponseDto, TagResponseDto } from './dto/collection-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Catalog')
@Public()
@Controller()
export class CollectionsController {
  constructor(private readonly catalogService: CatalogService) {}

  // GET /collections
  @Get('collections')
  @ApiOperation({ summary: 'Get active collections within their date range' })
  @ApiResponse({ status: 200, type: [CollectionResponseDto] })
  @ApiQuery({ name: 'occasion', required: false })
  getCollections(@Query('occasion') occasion?: string): Promise<CollectionResponseDto[]> {
    return this.catalogService.getCollections({ isActive: true, occasion });
  }

  // GET /collections/:slug
  @Get('collections/:slug')
  @ApiOperation({ summary: 'Get collection by slug with paginated products' })
  getCollectionBySlug(
    @Param('slug') slug: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.catalogService.getCollectionBySlug(slug, pagination);
  }

  // GET /tags
  @Get('tags')
  @ApiOperation({ summary: 'Get all tags with product counts' })
  @ApiResponse({ status: 200, type: [TagResponseDto] })
  getAllTags(): Promise<TagResponseDto[]> {
    return this.catalogService.getAllTags();
  }
}
