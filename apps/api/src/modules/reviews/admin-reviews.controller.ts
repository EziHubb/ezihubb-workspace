import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { AdminReviewQueryDto } from './dto/review-query.dto';
import { AdminReplyDto, ReviewResponseDto } from './dto/review-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';
import { IsString, MinLength } from 'class-validator';

class ReplyDto {
  @IsString()
  @MinLength(1)
  reply!: string;
}

@ApiTags('admin / reviews')
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
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
  ): Promise<PaginatedResult<ReviewResponseDto>> {
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
