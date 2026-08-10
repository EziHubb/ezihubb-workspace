import {
  Get,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AdminService } from './admin.service';
import {
  DashboardKPIsDto,
  OrdersByStatusDto,
  RevenueChartPointDto,
  TopProductDto,
} from './dto/dashboard.dto';
import { ReviewResponseDto } from '../reviews/dto/review-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminController as AdminControllerDecorator } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';

class RevenueChartQuery {
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  days?: number = 30;
}

class TopProductsQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  limit?: number = 10;
}

@AdminControllerDecorator('dashboard')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly storeContext: StoreContextService,
  ) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get dashboard KPIs (revenue, orders, customers, etc.) — scoped to own store for shop owners' })
  async getKPIs(@Req() req: Request): Promise<DashboardKPIsDto> {
    const context = await this.storeContext.resolve(req);
    return this.adminService.getDashboardKPIs(context.storeId ?? undefined);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get daily revenue chart data — scoped to own store for shop owners' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days back (7–365, default 30)' })
  async getRevenueChart(@Req() req: Request, @Query() query: RevenueChartQuery): Promise<RevenueChartPointDto[]> {
    const context = await this.storeContext.resolve(req);
    return this.adminService.getRevenueChart(query.days ?? 30, context.storeId ?? undefined);
  }

  @Get('orders-by-status')
  @ApiOperation({ summary: 'Get order counts grouped by status — scoped to own store for shop owners' })
  async getOrdersByStatus(@Req() req: Request): Promise<OrdersByStatusDto[]> {
    const context = await this.storeContext.resolve(req);
    return this.adminService.getOrdersByStatus(context.storeId ?? undefined);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top products by revenue — scoped to own store for shop owners' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of products (1–50, default 10)' })
  async getTopProducts(@Req() req: Request, @Query() query: TopProductsQuery): Promise<TopProductDto[]> {
    const context = await this.storeContext.resolve(req);
    return this.adminService.getTopProducts(query.limit ?? 10, context.storeId ?? undefined);
  }

  @Get('platform')
  @ApiOperation({ summary: 'Get platform-wide stats (stores, products, revenue) — platform view only' })
  async getPlatformStats(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    this.storeContext.requirePlatformContext(context);
    return this.adminService.getPlatformStats();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent platform activity feed — platform view only' })
  async getActivity(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    this.storeContext.requirePlatformContext(context);
    return this.adminService.getRecentActivity();
  }

  @Get('top-stores')
  @ApiOperation({ summary: 'Get top stores by revenue — platform view only' })
  async getTopStores(@Req() req: Request, @Query('limit') limit?: string) {
    const context = await this.storeContext.resolve(req);
    this.storeContext.requirePlatformContext(context);
    return this.adminService.getTopStores(limit ? +limit : 5);
  }

  @Get('pending-reviews')
  @ApiOperation({ summary: 'Get paginated list of pending reviews awaiting approval — scoped to own store for shop owners' })
  async getPendingReviews(
    @Req() req: Request,
    @Query() query: PaginationDto,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const context = await this.storeContext.resolve(req);
    return this.adminService.getPendingReviews(query, context.storeId ?? undefined);
  }
}
