import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';
import { ShopStatsService } from './shop-stats.service';

interface JwtLike { role?: string; storeId?: string }

/** Returns storeId only for ADMIN (shop owner). SUPER_ADMIN gets null → no filter. */
function sellerStoreId(req: Request): string | null {
  const user = req.user as JwtLike | undefined;
  if (!user || user.role !== 'ADMIN') return null;
  return user.storeId ?? null;
}

@ApiTags('Admin Stats')
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class ShopStatsController {
  constructor(private readonly statsService: ShopStatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Shop traffic overview — visits, orders, revenue, conversion rate + time series' })
  getOverview(@Req() req: Request, @Query('range') range = '7d') {
    return this.statsService.getOverview(range, sellerStoreId(req));
  }

  @Get('shopper-stats')
  @ApiOperation({ summary: 'Shopper stats — item favourites, shop follows, reviews for range' })
  getShopperStats(@Req() req: Request, @Query('range') range = '30d') {
    return this.statsService.getShopperStats(range, sellerStoreId(req));
  }

  @Get('traffic-sources')
  @ApiOperation({ summary: 'Traffic source breakdown for range' })
  getTrafficSources(@Req() req: Request, @Query('range') range = '30d') {
    return this.statsService.getTrafficSources(range, sellerStoreId(req));
  }

  @Get('listings')
  @ApiOperation({ summary: 'All listings with views, favourites, orders, revenue — sortable' })
  getListings(
    @Query('page')  page  = '1',
    @Query('limit') limit = '20',
    @Query('sort')  sort  = 'views',
  ) {
    return this.statsService.getListings(Number(page), Number(limit), sort);
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
  @ApiOperation({ summary: 'Top search terms from platform search analytics' })
  getSearchTerms(@Query('limit') limit = '20') {
    return this.statsService.getSearchTerms(Number(limit));
  }
}
