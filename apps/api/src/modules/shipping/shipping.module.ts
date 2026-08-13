import { Module } from '@nestjs/common';
import { AdminShippingController } from './admin-shipping.controller';
import { TrackingWebhookController } from './tracking-webhook.controller';
import { ShippingService } from './shipping.service';
import { TrackingService } from './tracking.service';
import { LabelService } from './label.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminShippingController, TrackingWebhookController],
  providers: [ShippingService, TrackingService, LabelService],
  exports: [ShippingService, TrackingService, LabelService],
})
export class ShippingModule {}
