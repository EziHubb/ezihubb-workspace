import {
  Get,
  Query,
} from '@nestjs/common';
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
  constructor(private readonly adminService: AdminService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get dashboard KPIs (revenue, orders, customers, etc.)' })
  async getKPIs(): Promise<DashboardKPIsDto> {
    return this.adminService.getDashboardKPIs();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get daily revenue chart data' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days back (7–365, default 30)' })
  async getRevenueChart(@Query() query: RevenueChartQuery): Promise<RevenueChartPointDto[]> {
    return this.adminService.getRevenueChart(query.days ?? 30);
  }

  @Get('orders-by-status')
  @ApiOperation({ summary: 'Get order counts grouped by status' })
  async getOrdersByStatus(): Promise<OrdersByStatusDto[]> {
    return this.adminService.getOrdersByStatus();
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top products by revenue' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of products (1–50, default 10)' })
  async getTopProducts(@Query() query: TopProductsQuery): Promise<TopProductDto[]> {
    return this.adminService.getTopProducts(query.limit ?? 10);
  }

  @Get('pending-reviews')
  @ApiOperation({ summary: 'Get paginated list of pending reviews awaiting approval' })
  async getPendingReviews(
    @Query() query: PaginationDto,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    return this.adminService.getPendingReviews(query);
  }
}
