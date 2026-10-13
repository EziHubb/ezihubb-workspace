import { Module } from '@nestjs/common';
import { AdminShippingController } from './admin-shipping.controller';
import { TrackingWebhookController } from './tracking-webhook.controller';
import { ShippingService } from './shipping.service';
import { TrackingService } from './tracking.service';
import { LabelService } from './label.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [NotificationsModule, QueueModule],
  controllers: [AdminShippingController, TrackingWebhookController],
  providers: [ShippingService, TrackingService, LabelService],
  exports: [ShippingService, TrackingService, LabelService],
})
export class ShippingModule {}
