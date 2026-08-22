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
import { DomainEventProcessor } from './domain-event.processor';
import { EventBusService } from './event-bus.service';
import { DevBullModule } from './dev-bull.module';
import { FulfillmentModule } from '../modules/fulfillment/fulfillment.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { MarketingModule } from '../modules/marketing/marketing.module';

const ALL_QUEUES = [
  QUEUES.EMAIL,
  QUEUES.IMAGE_PROCESSING,
  QUEUES.ORDER_PROCESSING,
  QUEUES.SCHEDULED,
  QUEUES.ABANDONED_CART,
  QUEUES.MODERATION,
  QUEUES.FULFILLMENT,
  // Registered here as well as in AffiliatesModule/ProductsModule, because
  // only this module exports BullModule — those two register their queues
  // privately, so a producer outside them (PaymentsService fanning out after
  // a payment) cannot resolve the token otherwise. Same Redis keys either
  // way; a Queue provider is just a producer client.
  QUEUES.AFFILIATE_COMMISSION,
  QUEUES.LOW_STOCK,
  QUEUES.DOMAIN_EVENTS,
];
const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    FulfillmentModule,
    AnalyticsModule,
    MarketingModule,
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
          { name: QUEUES.AFFILIATE_COMMISSION },
          { name: QUEUES.LOW_STOCK },
          { name: QUEUES.DOMAIN_EVENTS },
        )]),
  ],
  providers: disableQueue
    ? []
    : [EmailProcessor, ImageProcessor, OrderProcessor, AbandonedCartProcessor, FulfillmentProcessor, ScheduledProcessor, QueueSchedulerService, DomainEventProcessor, EventBusService],
  // EventBusService is exported so any module can publish without importing
  // a queue or knowing a single subscriber.
  exports: disableQueue ? [DevBullModule, EventBusService] : [BullModule, EventBusService],
})
export class QueueModule {}
