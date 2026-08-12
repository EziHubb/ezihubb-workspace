import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { StoresController } from './stores.controller';
import { AdminStoresController, AdminPlatformSettingsController, AdminSellerPayoutsController, AdminFinanceController } from './admin-stores.controller';
import { SellerOrdersController, SellerPayoutsController, SellerReviewsController, SellerScoreController } from './seller-orders.controller';
import { StoresService } from './stores.service';
import { StoreOrdersService } from './store-orders.service';
import { PerformanceScoreService } from './performance-score.service';
import { StoreOwnerGuard } from './guards/store-owner.guard';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';
import { ReviewsModule } from '../reviews/reviews.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AnalyticsModule } from '../analytics/analytics.module';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ConfigModule,
    ReviewsModule,
    ModerationModule,
    AnalyticsModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.EMAIL])]
      : [BullModule.registerQueue({ name: QUEUES.EMAIL })]),
  ],
  controllers: [
    StoresController,
    AdminStoresController,
    AdminPlatformSettingsController,
    AdminSellerPayoutsController,
    AdminFinanceController,
    SellerOrdersController,
    SellerPayoutsController,
    SellerReviewsController,
    SellerScoreController,
  ],
  providers: [StoresService, StoreOrdersService, StoreOwnerGuard, PerformanceScoreService],
  exports:   [StoresService, StoreOrdersService, StoreOwnerGuard, PerformanceScoreService],
})
export class StoresModule {}
