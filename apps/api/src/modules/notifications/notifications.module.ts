import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.EMAIL })],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
