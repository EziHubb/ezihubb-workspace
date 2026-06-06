import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { ReviewQueryDto } from './dto/review-query.dto';

@ApiTags('reviews')
@Controller('reviews')
export class PublicReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

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
}
