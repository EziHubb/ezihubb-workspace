import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Store } from '@prisma/client';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyThrottlerGuard } from '../../common/guards/api-key-throttler.guard';
import { SearchService, SearchResultDto } from '../search/search.service';
import { SearchQueryDto } from '../search/dto/search-query.dto';

@Controller('partner/search')
@UseGuards(ApiKeyGuard, ApiKeyThrottlerGuard)
@ApiSecurity('apiKey')
@ApiTags('Partner API - Search')
export class PartnerSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search products in your store (results are always scoped to your store, regardless of any storeId in the query)' })
  search(
    @Req() req: Request & { store: Store },
    @Query() query: SearchQueryDto,
  ): Promise<SearchResultDto> {
    return this.searchService.search(query, req.store.id);
  }
}
