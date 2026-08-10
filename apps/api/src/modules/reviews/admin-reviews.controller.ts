import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { AdminReviewQueryDto } from './dto/review-query.dto';
import { AdminReviewResponseDto, ReviewResponseDto } from './dto/review-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { IsString, MinLength } from 'class-validator';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';

class ReplyDto {
  @IsString()
  @MinLength(1)
  reply!: string;
}

@AdminController('reviews')
export class AdminReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly storeContext: StoreContextService,
  ) {}

  @Get('counts')
  @ApiOperation({ summary: 'Count reviews grouped by status (for tab badges)' })
  async getCounts(@Req() req: Request): Promise<Record<string, number>> {
    const context = await this.storeContext.resolve(req);
    return this.reviewsService.getAdminCounts(context.storeId ?? undefined);
  }

  @Get()
  @ApiOperation({ summary: 'List all reviews with optional status filter' })
  async findAll(
    @Req() req: Request,
    @Query() query: AdminReviewQueryDto,
  ): Promise<PaginatedResult<AdminReviewResponseDto>> {
    const context = await this.storeContext.resolve(req);
    return this.reviewsService.findAllAdmin(query, context.storeId ?? undefined);
  }

  @Delete(':reviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Permanently delete a review' })
  async remove(@Req() req: Request, @Param('reviewId') reviewId: string): Promise<void> {
    const context = await this.storeContext.resolve(req);
    return this.reviewsService.adminDeleteReview(reviewId, context.storeId ?? undefined);
  }

  @Post(':reviewId/approve')
  @ApiOperation({ summary: 'Approve a pending review' })
  async approve(@Req() req: Request, @Param('reviewId') reviewId: string): Promise<ReviewResponseDto> {
    const context = await this.storeContext.resolve(req);
    return this.reviewsService.approveReview(reviewId, context.storeId ?? undefined);
  }

  @Post(':reviewId/hide')
  @ApiOperation({ summary: 'Hide a review' })
  async hide(@Req() req: Request, @Param('reviewId') reviewId: string): Promise<ReviewResponseDto> {
    const context = await this.storeContext.resolve(req);
    return this.reviewsService.hideReview(reviewId, context.storeId ?? undefined);
  }

  @Post(':reviewId/reply')
  @ApiOperation({ summary: 'Add or update admin reply on a review' })
  async reply(
    @Req() req: Request,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReplyDto,
  ): Promise<ReviewResponseDto> {
    const context = await this.storeContext.resolve(req);
    return this.reviewsService.replyToReview(reviewId, dto.reply, context.storeId ?? undefined);
  }
}
