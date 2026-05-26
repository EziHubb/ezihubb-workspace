import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { ProductListItemDto } from '../products/dto/product-list-item.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Search')
@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // GET /search
  @Get()
  @ApiOperation({ summary: 'Full-text product search with filters and sort' })
  @ApiResponse({ status: 200, type: [ProductListItemDto] })
  search(@Query() query: SearchQueryDto): Promise<PaginatedResult<ProductListItemDto>> {
    return this.searchService.search(query);
  }

  // GET /search/autocomplete
  @Get('autocomplete')
  @ApiOperation({ summary: 'Product name autocomplete (top 8, cached 5 min)' })
  @ApiQuery({ name: 'q', required: true, description: 'Partial search term (min 2 chars)' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: { type: 'string' } } })
  autocomplete(@Query('q') q = ''): Promise<string[]> {
    return this.searchService.autocomplete(q);
  }

  // GET /search/trending
  @Get('trending')
  @ApiOperation({ summary: 'Top 10 searched keywords in the last 7 days' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: { type: 'string' } } })
  getTrending(): Promise<string[]> {
    return this.searchService.getTrending();
  }
}
