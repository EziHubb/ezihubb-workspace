import {
  Controller, Get, Patch, Post, Param, Body, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreOwnerGuard } from './guards/store-owner.guard';
import { StoreOrdersService, UpdateStoreOrderDto } from './store-orders.service';
import { ReviewsService } from '../reviews/reviews.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class MarkShippedDto {
  trackingNumber: string;

  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @IsOptional()
  @IsString()
  carrier?: string;
}

export class ListStoreOrdersQueryDto extends PaginationDto {
  @IsOptional()
  status?: any;
}

@ApiTags('Seller - Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreOwnerGuard)
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(private readonly storeOrdersService: StoreOrdersService) {}

  /** GET /seller/orders/stats – dashboard KPIs */
  @Get('stats')
  getStats(@Req() req: any) {
    return this.storeOrdersService.getSellerDashboardStats(req.store.id);
  }

  /** GET /seller/orders/recent – last 5 orders */
  @Get('recent')
  getRecent(@Req() req: any) {
    return this.storeOrdersService.getRecentOrders(req.store.id);
  }

  /** GET /seller/orders – paginated order list */
  @Get()
  listOrders(@Req() req: any, @Query() query: ListStoreOrdersQueryDto) {
    return this.storeOrdersService.listStoreOrders(req.store.id, query);
  }

  /** GET /seller/orders/:id – order detail */
  @Get(':id')
  getOrder(@Req() req: any, @Param('id') id: string) {
    return this.storeOrdersService.getStoreOrderDetail(req.store.id, id);
  }

  /** PATCH /seller/orders/:id – update status/tracking/notes */
  @Patch(':id')
  updateOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateStoreOrderDto,
  ) {
    return this.storeOrdersService.updateStoreOrder(req.store.id, id, dto);
  }

  /** POST /seller/orders/:id/ship – mark shipped + notify buyer */
  @Post(':id/ship')
  markShipped(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: MarkShippedDto,
  ) {
    return this.storeOrdersService.markStoreOrderShipped(req.store.id, id, dto);
  }
}

/** GET /seller/payouts – payout history + available balance */
@ApiTags('Seller - Payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreOwnerGuard)
@Controller('seller/payouts')
export class SellerPayoutsController {
  constructor(private readonly storeOrdersService: StoreOrdersService) {}

  @Get()
  getPayouts(@Req() req: any, @Query() query: PaginationDto) {
    return this.storeOrdersService.getPayoutHistory(req.store.id, query);
  }
}

class SellerReviewReplyDto {
  @IsString() reply: string;
}

/** GET /seller/reviews – store review management */
@ApiTags('Seller - Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreOwnerGuard)
@Controller('seller/reviews')
export class SellerReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  listReviews(
    @Req() req: any,
    @Query() query: { page?: number; limit?: number; status?: string },
  ) {
    return this.reviewsService.listReviewsForStore(req.store.id, query);
  }

  @Post(':id/reply')
  replyToReview(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SellerReviewReplyDto,
  ) {
    return this.reviewsService.replyToReviewAsSeller(id, req.store.id, dto.reply);
  }
}
