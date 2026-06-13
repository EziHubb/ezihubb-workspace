import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';
import { CoinService } from './coin.service';
import { CoinController } from './coin.controller';
import { CoinExpireProcessor } from './coin-expire.processor';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.COINS])]
      : [BullModule.registerQueue({ name: QUEUES.COINS })]),
  ],
  controllers: [CoinController],
  providers: [
    CoinService,
    ...(disableQueue ? [] : [CoinExpireProcessor]),
  ],
  exports: [CoinService],
})
export class CoinModule {}
