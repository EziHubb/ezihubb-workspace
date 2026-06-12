import {
  Controller, Get, Post, Query, Body, UseGuards,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ReviewsService } from './reviews.service';
import { ReviewQueryDto } from './dto/review-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { StorageService } from '../../common/services/storage.service';

@ApiTags('reviews')
@Controller('reviews')
export class PublicReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all approved reviews (global, paginated)' })
  getAll(@Query() query: ReviewQueryDto) {
    return this.reviewsService.getGlobalReviews(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Global review summary — average rating + distribution across all products' })
  getSummary() {
    return this.reviewsService.getGlobalSummary();
  }

  @Get('me/reviewable-products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List products from delivered orders that have not yet been reviewed' })
  getReviewableProducts(@CurrentUser() user: JwtPayload) {
    return this.reviewsService.getReviewableProducts(user.sub);
  }

  @Get('can-review')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if the authenticated user can review a product' })
  async canReview(
    @Query('productId') productId: string,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    if (!user) return { canReview: false, reason: 'not_authenticated' };
    const eligible = await this.reviewsService.getReviewableProducts(user.sub);
    const canReview = eligible.some((p) => p.productId === productId);
    return { canReview, reason: canReview ? null : 'no_eligible_order' };
  }

  @Post('upload-image')
  @UseGuards(OptionalAuthGuard)
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a review image, returns CDN URL' })
  async uploadReviewImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No image provided');
    const key = `reviews/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const url = await this.storageService.uploadFile(file.buffer, key, file.mimetype);
    return { url };
  }
}
