import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { QueueModule } from '../../queue/queue.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';

@Module({
  imports: [QueueModule, AnalyticsModule, AffiliatesModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
