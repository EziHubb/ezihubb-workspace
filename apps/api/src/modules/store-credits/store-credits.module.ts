import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StoreCreditsService } from './store-credits.service';
import { StoreCreditsController } from './store-credits.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    BullModule.registerQueue({ name: QUEUES.EMAIL }),
  ],
  controllers: [StoreCreditsController],
  providers:   [StoreCreditsService],
  exports:     [StoreCreditsService],
})
export class StoreCreditsModule {}
