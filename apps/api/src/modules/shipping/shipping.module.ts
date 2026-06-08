import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { AdminShippingController } from './admin-shipping.controller';
import { TrackingWebhookController } from './tracking-webhook.controller';
import { ShippingService } from './shipping.service';
import { TrackingService } from './tracking.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ShippingController, AdminShippingController, TrackingWebhookController],
  providers: [ShippingService, TrackingService],
  exports: [ShippingService, TrackingService],
})
export class ShippingModule {}
