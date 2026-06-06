import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DevBullModule } from '../../queue/dev-bull.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [...(process.env['DISABLE_QUEUE'] !== 'true'
      ? [BullModule.registerQueue({ name: QUEUES.EMAIL })]
      : [DevBullModule.forQueues([QUEUES.EMAIL])])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
