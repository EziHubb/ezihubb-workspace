import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';
import { GiftPoolService } from './gift-pool.service';
import { GiftPoolController, AdminGiftPoolController } from './gift-pool.controller';
import { GiftPoolProcessor } from './gift-pool.processor';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    PrismaModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.GIFT_POOLS])]
      : [BullModule.registerQueue({ name: QUEUES.GIFT_POOLS })]),
  ],
  controllers: [GiftPoolController, AdminGiftPoolController],
  providers: [
    GiftPoolService,
    ...(disableQueue ? [] : [GiftPoolProcessor]),
  ],
  exports: [GiftPoolService],
})
export class GiftPoolModule {}
