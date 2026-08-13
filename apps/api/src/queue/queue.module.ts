import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from './queue.constants';
import { EmailProcessor } from './email.processor';
import { ImageProcessor } from './image.processor';
import { OrderProcessor } from './order.processor';
import { AbandonedCartProcessor } from './abandoned-cart.processor';
import { FulfillmentProcessor } from './fulfillment.processor';
import { ScheduledProcessor } from './scheduled.processor';
import { QueueSchedulerService } from './queue-scheduler.service';
import { DevBullModule } from './dev-bull.module';
import { FulfillmentModule } from '../modules/fulfillment/fulfillment.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';

const ALL_QUEUES = [
  QUEUES.EMAIL,
  QUEUES.IMAGE_PROCESSING,
  QUEUES.ORDER_PROCESSING,
  QUEUES.SCHEDULED,
  QUEUES.ABANDONED_CART,
  QUEUES.MODERATION,
  QUEUES.FULFILLMENT,
];
const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    FulfillmentModule,
    AnalyticsModule,
    ...(disableQueue
      ? [DevBullModule.forQueues(ALL_QUEUES)]
      : [BullModule.registerQueue(
          { name: QUEUES.EMAIL },
          { name: QUEUES.IMAGE_PROCESSING },
          { name: QUEUES.ORDER_PROCESSING },
          { name: QUEUES.SCHEDULED },
          { name: QUEUES.ABANDONED_CART },
          { name: QUEUES.MODERATION },
          { name: QUEUES.FULFILLMENT },
        )]),
  ],
  providers: disableQueue
    ? []
    : [EmailProcessor, ImageProcessor, OrderProcessor, AbandonedCartProcessor, FulfillmentProcessor, ScheduledProcessor, QueueSchedulerService],
  exports: disableQueue ? [DevBullModule] : [BullModule],
})
export class QueueModule {}
