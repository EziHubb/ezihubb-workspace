import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ModerationService } from './moderation.service';
import { TextModerationService } from './text-moderation.service';
import { ImageModerationService } from './image-moderation.service';
import { ModerationProcessor } from './moderation.processor';
import { ModerationController, StoreViolationsController } from './moderation.controller';
import { QUEUES } from '../../queue/queue.constants';
import { DevBullModule } from '../../queue/dev-bull.module';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.MODERATION, QUEUES.EMAIL])]
      : [BullModule.registerQueue({ name: QUEUES.MODERATION }, { name: QUEUES.EMAIL })]),
  ],
  controllers: [ModerationController, StoreViolationsController],
  providers: [
    ModerationService,
    TextModerationService,
    ImageModerationService,
    ...(disableQueue ? [] : [ModerationProcessor]),
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
