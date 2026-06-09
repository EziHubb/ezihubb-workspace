import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TaxModule } from '../tax/tax.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';

@Module({
  imports: [ShippingModule, PaymentsModule, NotificationsModule, TaxModule, AffiliatesModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
