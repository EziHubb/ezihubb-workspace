import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewResponseDto, ReviewSummaryDto } from './dto/review-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

@ApiTags('reviews')
@Controller('products/:slug/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List approved reviews for a product' })
  async getReviews(
    @Param('slug') slug: string,
    @Query() query: ReviewQueryDto,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    return this.reviewsService.getProductReviews(slug, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get review summary (average rating, distribution) for a product' })
  async getSummary(@Param('slug') slug: string): Promise<ReviewSummaryDto> {
    return this.reviewsService.getProductSummaryBySlug(slug);
  }

  @Get('my-review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current user's own review for this product (null if not reviewed)" })
  async getMyReview(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewResponseDto | null> {
    return this.reviewsService.getMyReview(user.sub, slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a review (requires delivered/completed order)' })
  async createReview(
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.createReview(user.sub, slug, dto);
  }

  @Patch(':reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update own pending review' })
  async updateReview(
    @Param('reviewId') reviewId: string,
    @Body() dto: Partial<CreateReviewDto>,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.updateReview(user.sub, reviewId, dto);
  }

  @Delete(':reviewId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own review' })
  async deleteReview(
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.reviewsService.deleteReview(user.sub, reviewId);
  }

  @Post(':reviewId/helpful')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a review as helpful (anonymous, one increment per call)' })
  async markHelpful(@Param('reviewId') reviewId: string): Promise<void> {
    return this.reviewsService.markHelpful(reviewId);
  }

  @Post(':reviewId/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 5))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload images for a review (max 5 total)' })
  async uploadImages(
    @Param('reviewId') reviewId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewResponseDto> {
    if (!files?.length) {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'No images provided' });
    }
    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE) {
        throw new BadRequestException({ code: 'ERR_FILE_TOO_LARGE', message: `File "${file.originalname}" exceeds 5 MB` });
      }
      if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
        throw new BadRequestException({ code: 'ERR_FILE_TYPE_INVALID', message: `File type "${file.mimetype}" is not supported` });
      }
    }
    return this.reviewsService.uploadReviewImages(user.sub, reviewId, files);
  }
}
