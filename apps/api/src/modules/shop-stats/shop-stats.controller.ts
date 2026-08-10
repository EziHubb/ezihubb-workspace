import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { StoreContextService } from '../../common/services/store-context.service';
import { ProductOwnershipGuard } from '../../common/guards/product-ownership.guard';
import { ShopStatsService } from './shop-stats.service';

@ApiTags('Admin Stats')
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard, ProductOwnershipGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class ShopStatsController {
  constructor(
    private readonly statsService: ShopStatsService,
    private readonly storeContext: StoreContextService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Shop traffic overview — visits, orders, revenue, conversion rate + time series' })
  async getOverview(@Req() req: Request, @Query('range') range = '7d') {
    const context = await this.storeContext.resolve(req);
    return this.statsService.getOverview(range, context.storeId);
  }

  @Get('shopper-stats')
  @ApiOperation({ summary: 'Shopper stats — item favourites, shop follows, reviews for range' })
  async getShopperStats(@Req() req: Request, @Query('range') range = '30d') {
    const context = await this.storeContext.resolve(req);
    return this.statsService.getShopperStats(range, context.storeId);
  }

  @Get('traffic-sources')
  @ApiOperation({ summary: 'Traffic source breakdown for range' })
  async getTrafficSources(@Req() req: Request, @Query('range') range = '30d') {
    const context = await this.storeContext.resolve(req);
    return this.statsService.getTrafficSources(range, context.storeId);
  }

  @Get('listings')
  @ApiOperation({ summary: 'All listings with views, favourites, orders, revenue — sortable (scoped to own store for shop owners)' })
  async getListings(
    @Req() req: Request,
    @Query('page')  page  = '1',
    @Query('limit') limit = '20',
    @Query('sort')  sort  = 'views',
  ) {
    const context = await this.storeContext.resolve(req);
    return this.statsService.getListings(Number(page), Number(limit), sort, context.storeId ?? undefined);
  }

  @Get('listings/:productId')
  @ApiOperation({ summary: 'Individual listing detailed stats with time series' })
  getListingStats(
    @Param('productId') productId: string,
    @Query('range')     range = '30d',
  ) {
    return this.statsService.getListingStats(productId, range);
  }

  @Get('search-terms')
  @ApiOperation({ summary: 'Top search terms from platform search analytics — platform view only (meaningless per-store)' })
  async getSearchTerms(@Req() req: Request, @Query('limit') limit = '20') {
    const context = await this.storeContext.resolve(req);
    this.storeContext.requirePlatformContext(context);
    return this.statsService.getSearchTerms(Number(limit));
  }
}
