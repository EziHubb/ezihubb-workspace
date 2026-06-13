import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { AdminReviewQueryDto } from './dto/review-query.dto';
import { AdminReplyDto, AdminReviewResponseDto, ReviewResponseDto } from './dto/review-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { IsString, MinLength } from 'class-validator';
import { AdminController } from '../../common/decorators/admin-controller.decorator';

class ReplyDto {
  @IsString()
  @MinLength(1)
  reply!: string;
}

@AdminController('reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('counts')
  @ApiOperation({ summary: 'Count reviews grouped by status (for tab badges)' })
  async getCounts(): Promise<Record<string, number>> {
    return this.reviewsService.getAdminCounts();
  }

  @Get()
  @ApiOperation({ summary: 'List all reviews with optional status filter' })
  async findAll(
    @Query() query: AdminReviewQueryDto,
  ): Promise<PaginatedResult<AdminReviewResponseDto>> {
    return this.reviewsService.findAllAdmin(query);
  }

  @Delete(':reviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Permanently delete a review' })
  async remove(@Param('reviewId') reviewId: string): Promise<void> {
    return this.reviewsService.adminDeleteReview(reviewId);
  }

  @Post(':reviewId/approve')
  @ApiOperation({ summary: 'Approve a pending review' })
  async approve(@Param('reviewId') reviewId: string): Promise<ReviewResponseDto> {
    return this.reviewsService.approveReview(reviewId);
  }

  @Post(':reviewId/hide')
  @ApiOperation({ summary: 'Hide a review' })
  async hide(@Param('reviewId') reviewId: string): Promise<ReviewResponseDto> {
    return this.reviewsService.hideReview(reviewId);
  }

  @Post(':reviewId/reply')
  @ApiOperation({ summary: 'Add or update admin reply on a review' })
  async reply(
    @Param('reviewId') reviewId: string,
    @Body() dto: ReplyDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.replyToReview(reviewId, dto.reply);
  }
}
