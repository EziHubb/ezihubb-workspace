import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SearchService, SearchResultDto } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Search')
@Public()
@Throttle({ default: { ttl: 60_000, limit: 120 } })   // higher limit for search UX
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // GET /search
  @Get()
  @ApiOperation({ summary: 'Full-text product search with filters, facets, and sort' })
  @ApiResponse({ status: 200, description: 'Paginated products + facets + appliedFilters' })
  search(@Query() query: SearchQueryDto): Promise<SearchResultDto> {
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

  // GET /search/related?q=...
  @Get('related')
  @ApiOperation({ summary: 'Related search keyword suggestions based on trending data' })
  @ApiQuery({ name: 'q', required: true, description: 'Search term to find related queries for' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: { type: 'string' } } })
  getRelated(@Query('q') q = ''): Promise<string[]> {
    return this.searchService.getRelated(q);
  }
}
