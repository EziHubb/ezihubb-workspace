import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { ReviewQueryDto } from './dto/review-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

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

  @Get('me/reviewable-products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List products from delivered orders that have not yet been reviewed' })
  getReviewableProducts(@CurrentUser() user: JwtPayload) {
    return this.reviewsService.getReviewableProducts(user.sub);
  }
}
