import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrderDownloadsController } from './order-downloads.controller';
import { AdminOrderProgressController } from './admin-order-progress.controller';
import { OrdersService } from './orders.service';
import { OrderProgressService } from './order-progress.service';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { PdfModule } from '../pdf/pdf.module';
import { FulfillmentModule } from '../fulfillment/fulfillment.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BundleOffersModule } from '../promotions/bundle-offers.module';
import { MarketingModule } from '../marketing/marketing.module';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ShippingModule, PaymentsModule, NotificationsModule, AffiliatesModule, PdfModule,
    FulfillmentModule, AnalyticsModule, BundleOffersModule, MarketingModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.EMAIL])]
      : [BullModule.registerQueue({ name: QUEUES.EMAIL })]),
  ],
  controllers: [OrdersController, AdminOrdersController, OrderDownloadsController, AdminOrderProgressController],
  providers: [OrdersService, OrderProgressService],
  exports: [OrdersService, OrderProgressService],
})
export class OrdersModule {}
