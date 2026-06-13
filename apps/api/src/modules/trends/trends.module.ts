import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { TrendsService } from './trends.service';
import { TrendsController } from './trends.controller';
import { TrendsProcessor } from './trends.processor';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ConfigModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.EMAIL, QUEUES.AI_FEATURES])]
      : [
          BullModule.registerQueue({ name: QUEUES.EMAIL }),
          BullModule.registerQueue({ name: QUEUES.AI_FEATURES }),
        ]),
  ],
  controllers: [TrendsController],
  providers:   [TrendsService, TrendsProcessor],
  exports:     [TrendsService, TrendsProcessor],
})
export class TrendsModule {}
