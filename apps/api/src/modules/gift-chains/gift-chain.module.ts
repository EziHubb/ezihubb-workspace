import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';
import { GiftChainService } from './gift-chain.service';
import { GiftChainController } from './gift-chain.controller';
import { GiftChainProcessor } from './gift-chain.processor';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    PrismaModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.GIFT_CHAINS])]
      : [BullModule.registerQueue({ name: QUEUES.GIFT_CHAINS })]),
  ],
  controllers: [GiftChainController],
  providers: [
    GiftChainService,
    ...(disableQueue ? [] : [GiftChainProcessor]),
  ],
  exports: [GiftChainService],
})
export class GiftChainModule {}
