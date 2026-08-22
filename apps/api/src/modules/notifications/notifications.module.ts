import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DevBullModule } from '../../queue/dev-bull.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController, NewsletterController, NotificationFeedController } from './notifications.controller';
import { FcmService } from './fcm.service';
import { PushService } from './push.service';
import { QUEUES } from '../../queue/queue.constants';
@Module({
  imports: [
    ...(process.env['DISABLE_QUEUE'] !== 'true'
      ? [BullModule.registerQueue({ name: QUEUES.EMAIL })]
      : [DevBullModule.forQueues([QUEUES.EMAIL])]),
  ],
  controllers: [NotificationFeedController, NotificationsController, NewsletterController],
  providers: [NotificationsService, FcmService, PushService],
  exports: [NotificationsService, FcmService, PushService],
})
export class NotificationsModule {}
