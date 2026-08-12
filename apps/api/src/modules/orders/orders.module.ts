import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrderDownloadsController } from './order-downloads.controller';
import { OrdersService } from './orders.service';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { PdfModule } from '../pdf/pdf.module';
import { FulfillmentModule } from '../fulfillment/fulfillment.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [ShippingModule, PaymentsModule, NotificationsModule, AffiliatesModule, PdfModule, FulfillmentModule, AnalyticsModule],
  controllers: [OrdersController, AdminOrdersController, OrderDownloadsController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
