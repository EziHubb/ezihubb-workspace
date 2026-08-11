import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { PaypalService } from './paypal.service';
import { QueueModule } from '../../queue/queue.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [QueueModule, AnalyticsModule, AffiliatesModule, ProductsModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, PaypalService],
  exports: [PaymentsService, PaypalService],
})
export class PaymentsModule {}
