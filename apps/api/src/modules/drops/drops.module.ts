import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { DropsService } from './drops.service';
import { DropsController } from './drops.controller';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../../prisma/prisma.module';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    NotificationsModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.EMAIL])]
      : [BullModule.registerQueue({ name: QUEUES.EMAIL })]),
  ],
  controllers: [DropsController],
  providers:   [DropsService],
  exports:     [DropsService],
})
export class DropsModule {}
