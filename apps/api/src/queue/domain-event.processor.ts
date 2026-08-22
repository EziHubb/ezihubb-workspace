import { Logger } from '@nestjs/common';
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import {
  DEFAULT_JOB_OPTIONS,
  QUEUES,
  type QueueName,
} from './queue.constants';
import {
  EVENT_SUBSCRIBERS,
  subscriberJobId,
  type DomainEvent,
  type DomainEventPayload,
} from './domain-events';

/**
 * The broker.
 *
 * Consumes one published event and fans it out to whoever subscribed, per the
 * table in domain-events.ts. Nothing in here knows what any subscriber does —
 * it only moves a job onto the right queue.
 *
 * Why a durable queue rather than an in-process emitter: an emitter loses every
 * pending handler if the process dies between emit and handle, and gives no
 * retries. The whole reason for this refactor was that post-payment side
 * effects were being lost silently, so an in-memory bus would have restated the
 * problem in nicer syntax.
 */
@Processor(QUEUES.DOMAIN_EVENTS)
export class DomainEventProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainEventProcessor.name);

  /** Every queue a subscriber can target, keyed by name. */
  private readonly queues: Partial<Record<QueueName, Queue>>;

  constructor(
    @InjectQueue(QUEUES.ORDER_PROCESSING) orderQueue: Queue,
    @InjectQueue(QUEUES.AFFILIATE_COMMISSION) commissionQueue: Queue,
    @InjectQueue(QUEUES.LOW_STOCK) lowStockQueue: Queue,
  ) {
    super();
    this.queues = {
      [QUEUES.ORDER_PROCESSING]:     orderQueue,
      [QUEUES.AFFILIATE_COMMISSION]: commissionQueue,
      [QUEUES.LOW_STOCK]:            lowStockQueue,
    };
  }

  async process(job: Job<DomainEventPayload>): Promise<void> {
    const event = job.name as DomainEvent;
    const subscribers = EVENT_SUBSCRIBERS[event];

    if (!subscribers) {
      // Not an error worth retrying: retrying cannot conjure a subscriber, and
      // failing the job would bury a real config mistake in a retry loop.
      this.logger.warn(`No subscribers registered for event "${event}" — dropping`);
      return;
    }

    const { entityId } = job.data;

    // Sequential, not Promise.all. These are Redis writes on one connection, a
    // handful per event, so concurrency buys nothing measurable — and if one
    // add throws, a sequential loop leaves the already-dispatched jobs standing
    // and lets the retry fill in the rest by jobId, rather than a rejected
    // Promise.all obscuring which ones landed.
    for (const sub of subscribers) {
      const queue = this.queues[sub.queue];
      if (!queue) {
        // A subscriber pointing at a queue this processor cannot reach is a
        // wiring bug. Throwing would retry forever against a fixed config, so
        // it is logged loudly and the rest of the fan-out still happens.
        this.logger.error(
          `Subscriber ${sub.job} targets unregistered queue "${sub.queue}" — skipped`,
        );
        continue;
      }

      await queue.add(
        sub.job,
        { orderId: entityId },
        { ...DEFAULT_JOB_OPTIONS, jobId: subscriberJobId(event, sub.job, entityId) },
      );
    }

    this.logger.log(`Dispatched ${event} (${entityId}) to ${subscribers.length} subscribers`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Event dispatch failed: event=${job?.name} id=${job?.id} — ${error.message}`,
    );
  }
}
