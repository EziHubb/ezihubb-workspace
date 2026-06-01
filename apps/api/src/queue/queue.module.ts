import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from './queue.constants';
import { EmailProcessor } from './email.processor';
import { ImageProcessor } from './image.processor';
import { OrderProcessor } from './order.processor';
import { DevBullModule } from './dev-bull.module';

const ALL_QUEUES = [QUEUES.EMAIL, QUEUES.IMAGE_PROCESSING, QUEUES.ORDER_PROCESSING, QUEUES.SCHEDULED];
const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ...(disableQueue
      ? [DevBullModule.forQueues(ALL_QUEUES)]
      : [BullModule.registerQueue(
          { name: QUEUES.EMAIL },
          { name: QUEUES.IMAGE_PROCESSING },
          { name: QUEUES.ORDER_PROCESSING },
          { name: QUEUES.SCHEDULED },
        )]),
  ],
  providers: disableQueue ? [] : [EmailProcessor, ImageProcessor, OrderProcessor],
  exports: disableQueue ? [DevBullModule] : [BullModule],
})
export class QueueModule {}
