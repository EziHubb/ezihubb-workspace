import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { TrendsService }        from './trends.service';
import { TrendsController }     from './trends.controller';
import { TrendsProcessor }      from './trends.processor';
import { TrendSourceRegistry }  from './source-registry.service';
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
  providers:   [TrendsService, TrendsProcessor, TrendSourceRegistry],
  exports:     [TrendsService, TrendsProcessor, TrendSourceRegistry],
})
export class TrendsModule {}
