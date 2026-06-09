import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { QueueModule } from '../../queue/queue.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [QueueModule, AnalyticsModule, AffiliatesModule, LoyaltyModule, ProductsModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
