import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { CreatorDnaService } from './creator-dna.service';
import { CreatorDnaController } from './creator-dna.controller';
import { CreatorDnaProcessor } from './creator-dna.processor';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ConfigModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.AI_FEATURES])]
      : [BullModule.registerQueue({ name: QUEUES.AI_FEATURES })]),
  ],
  controllers: [CreatorDnaController],
  providers:   [CreatorDnaService, CreatorDnaProcessor],
  exports:     [CreatorDnaService, CreatorDnaProcessor],
})
export class CreatorDnaModule {}
