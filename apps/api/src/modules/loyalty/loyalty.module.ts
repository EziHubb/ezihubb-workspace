import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyProcessor } from './loyalty.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ConfigModule,
    NotificationsModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.LOYALTY, QUEUES.EMAIL])]
      : [
          BullModule.registerQueue({ name: QUEUES.LOYALTY }),
          BullModule.registerQueue({ name: QUEUES.EMAIL }),
        ]),
  ],
  controllers: [LoyaltyController],
  providers: [
    LoyaltyService,
    ...(disableQueue ? [] : [LoyaltyProcessor]),
  ],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
