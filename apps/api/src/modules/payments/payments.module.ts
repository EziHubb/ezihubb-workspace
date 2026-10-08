import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { PaypalService } from './paypal.service';
import { OrderPayerService } from './order-payer.service';
import { EconomicPaymentsService } from './economic-payments.service';
import { QueueModule } from '../../queue/queue.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { ProductsModule } from '../products/products.module';
import { FinancesModule } from '../finances/finances.module';

@Module({
  imports: [QueueModule, AnalyticsModule, AffiliatesModule, ProductsModule, FinancesModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [OrderPayerService, EconomicPaymentsService, PaymentsService, PaypalService],
  exports: [PaymentsService, PaypalService],
})
export class PaymentsModule {}
