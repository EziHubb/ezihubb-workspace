import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@ezihubb/constants';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { StoreContext, StoreContextService } from '../../common/services/store-context.service';
import { MarketplaceInsightsService } from './marketplace-insights.service';
import { SaveSearchDto } from './dto/save-search.dto';
import { RelatedTermFeedbackDto } from './dto/related-term-feedback.dto';

/**
 * Seller-facing keyword-research tool (Etsy "Marketplace Insights" analog).
 * Unlike ShopStatsController's platform-only search-terms endpoint, this is
 * meant for individual sellers — a plain ADMIN (shop owner) is auto-scoped to
 * their own store via StoreContextService for the "your prices" section; a
 * platform-context SUPER_ADMIN sees market-wide data with yourPrices=null.
 */
@ApiTags('Marketplace Insights')
@Controller('marketplace-insights')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MarketplaceInsightsController {
  constructor(
    private readonly insightsService: MarketplaceInsightsService,
    private readonly storeContext: StoreContextService,
  ) {}

  @Get('trending')
  @ApiOperation({ summary: 'Top searched keywords across the marketplace (last 30 days, with trend vs prior period), optionally filtered to one category' })
  getTrending(@Query('limit') limit = '20', @Query('category') category?: string) {
    return this.insightsService.getTrending(Number(limit), category);
  }

  @Get('terms/:term')
  @ApiOperation({ summary: 'Deep-dive on one keyword: volume trend, conversion rate, related terms. Counts against the caller\'s daily lookup quota.' })
  async getTermDetail(@Req() req: Request, @Param('term') term: string, @Query('days') days = '30') {
    const context: StoreContext = await this.storeContext.resolve(req);
    return this.insightsService.getTermDetail(term, Number(days), context.storeId);
  }

  @Get('quota')
  @ApiOperation({ summary: "Caller's remaining daily search-term lookup quota" })
  async getQuota(@Req() req: Request) {
    const context: StoreContext = await this.storeContext.resolve(req);
    return this.insightsService.getQuota(context.storeId);
  }

  @Get('terms/:term/analysis')
  @ApiOperation({ summary: 'Price benchmarking + bestseller listings for a keyword, plus the caller\'s own store price positioning' })
  async getTermAnalysis(@Req() req: Request, @Param('term') term: string) {
    const context: StoreContext = await this.storeContext.resolve(req);
    return this.insightsService.getTermAnalysis(term, context.storeId);
  }

  @Post('terms/:term/related-feedback')
  @ApiOperation({ summary: 'Thumbs up/down a "similar search term" suggestion — improves future suggestions for this term' })
  async submitRelatedTermFeedback(@Param('term') term: string, @Body() dto: RelatedTermFeedbackDto): Promise<void> {
    await this.insightsService.submitRelatedTermFeedback(term, dto.relatedTerm, dto.helpful);
  }

  @Get('saved-searches')
  @ApiOperation({ summary: "List the current seller's saved search terms" })
  listSavedSearches(@CurrentUser() user: JwtPayload) {
    return this.insightsService.listSavedSearches(user.sub);
  }

  @Post('saved-searches')
  @ApiOperation({ summary: 'Save a search term to track later' })
  saveSearch(@CurrentUser() user: JwtPayload, @Body() dto: SaveSearchDto) {
    return this.insightsService.saveSearch(user.sub, dto.term);
  }

  @Delete('saved-searches/:id')
  @ApiOperation({ summary: 'Remove a saved search term' })
  async deleteSavedSearch(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.insightsService.deleteSavedSearch(user.sub, id);
  }
}
