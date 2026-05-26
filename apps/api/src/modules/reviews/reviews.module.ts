import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReviewsController } from './reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { ReviewsService } from './reviews.service';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.EMAIL })],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
