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
import { PrismaService } from '../../prisma/prisma.service';

interface JwtLike { sub?: string; id?: string; role?: string }

async function resolveSellerStoreId(prisma: PrismaService, user: JwtLike): Promise<string | null> {
  if (user.role === 'SUPER_ADMIN') return null;
  const userId = user.sub ?? user.id;
  if (!userId) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { storeId: true } });
  return dbUser?.storeId ?? null;
}

class ReplyDto {
  @IsString()
  @MinLength(1)
  reply!: string;
}

@AdminController('reviews')
export class AdminReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('counts')
  @ApiOperation({ summary: 'Count reviews grouped by status (for tab badges)' })
  async getCounts(@Req() req: Request): Promise<Record<string, number>> {
    const storeId = await resolveSellerStoreId(this.prisma, req.user as JwtLike);
    return this.reviewsService.getAdminCounts(storeId ?? undefined);
  }

  @Get()
  @ApiOperation({ summary: 'List all reviews with optional status filter' })
  async findAll(
    @Req() req: Request,
    @Query() query: AdminReviewQueryDto,
  ): Promise<PaginatedResult<AdminReviewResponseDto>> {
    const storeId = await resolveSellerStoreId(this.prisma, req.user as JwtLike);
    return this.reviewsService.findAllAdmin(query, storeId ?? undefined);
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
