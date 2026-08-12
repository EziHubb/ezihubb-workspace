import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { StoreContext, StoreContextService } from '../../common/services/store-context.service';
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

  /**
   * Unlike `resolveTargetStoreId` (used by fulfillment/API-keys, which always
   * requires exactly one store), a platform-context caller here may
   * legitimately leave `storeId` unset to see the platform-wide aggregate —
   * so `null` is a valid result, not an error.
   */
  private targetStoreId(context: StoreContext, storeId?: string): string | null {
    if (!context.isPlatformContext) return context.storeId;
    return storeId ?? null;
  }

  @Get('overview')
  @ApiOperation({ summary: 'Shop traffic overview — visits, orders, revenue, conversion rate + time series' })
  async getOverview(@Req() req: Request, @Query('range') range = '7d', @Query('storeId') storeId?: string) {
    const context = await this.storeContext.resolve(req);
    return this.statsService.getOverview(range, this.targetStoreId(context, storeId));
  }

  @Get('shopper-stats')
  @ApiOperation({ summary: 'Shopper stats — item favourites, shop follows, reviews for range' })
  async getShopperStats(@Req() req: Request, @Query('range') range = '30d', @Query('storeId') storeId?: string) {
    const context = await this.storeContext.resolve(req);
    return this.statsService.getShopperStats(range, this.targetStoreId(context, storeId));
  }

  @Get('traffic-sources')
  @ApiOperation({ summary: 'Conversion funnel (visits → product views → add to cart → checkout → orders) for range' })
  async getConversionFunnel(@Req() req: Request, @Query('range') range = '30d', @Query('storeId') storeId?: string) {
    const context = await this.storeContext.resolve(req);
    return this.statsService.getConversionFunnel(range, this.targetStoreId(context, storeId));
  }

  @Get('listings')
  @ApiOperation({ summary: 'All listings with views, favourites, orders, revenue — sortable (scoped to own store for shop owners)' })
  async getListings(
    @Req() req: Request,
    @Query('page')  page  = '1',
    @Query('limit') limit = '20',
    @Query('sort')  sort  = 'views',
    @Query('storeId') storeId?: string,
  ) {
    const context = await this.storeContext.resolve(req);
    return this.statsService.getListings(Number(page), Number(limit), sort, this.targetStoreId(context, storeId) ?? undefined);
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
