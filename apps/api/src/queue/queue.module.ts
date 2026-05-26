import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from './queue.constants';
import { EmailProcessor } from './email.processor';
import { ImageProcessor } from './image.processor';
import { OrderProcessor } from './order.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.EMAIL },
      { name: QUEUES.IMAGE_PROCESSING },
      { name: QUEUES.ORDER_PROCESSING },
      { name: QUEUES.SCHEDULED },
    ),
  ],
  providers: [EmailProcessor, ImageProcessor, OrderProcessor],
  // Export BullModule so other modules can inject InjectQueue tokens
  exports: [BullModule],
})
export class QueueModule {}
