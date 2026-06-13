import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminAiController } from './admin-ai.controller';
import { AiFeaturesProcessor } from './ai-features.processor';
import { AiStatsService } from './ai-stats.service';
import { PricingModule } from '../pricing/pricing.module';
import { TrendsModule } from '../trends/trends.module';
import { CreatorDnaModule } from '../creator-dna/creator-dna.module';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    PricingModule,
    TrendsModule,
    CreatorDnaModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.AI_FEATURES])]
      : [BullModule.registerQueue({ name: QUEUES.AI_FEATURES })]),
  ],
  controllers: [AdminAiController],
  providers:   [AiFeaturesProcessor, AiStatsService],
})
export class AdminAiModule {}
