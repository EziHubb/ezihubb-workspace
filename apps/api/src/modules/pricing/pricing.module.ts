import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ConfigModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.EMAIL])]
      : [BullModule.registerQueue({ name: QUEUES.EMAIL })]),
  ],
  controllers: [PricingController],
  providers:   [PricingService],
  exports:     [PricingService],
})
export class PricingModule {}
