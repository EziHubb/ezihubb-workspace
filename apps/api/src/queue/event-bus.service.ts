import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS, QUEUES } from './queue.constants';
import type { DomainEvent, DomainEventPayload } from './domain-events';

/**
 * The only thing a publisher needs.
 *
 * Callers say what happened and to which entity. They do not name a queue, a
 * job, or a consumer — that is the entire point, and the reason this takes a
 * plain id rather than an options object: there is nothing else to decide.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @InjectQueue(QUEUES.DOMAIN_EVENTS) private readonly events: Queue,
  ) {}

  /**
   * Publishes one event. Returns once the event is durably queued, not once
   * subscribers have run — the caller is finished at that point, which is what
   * lets a webhook answer Stripe promptly without abandoning the work.
   *
   * The jobId is keyed on event + entity, so publishing the same event twice
   * for the same entity produces one dispatch. That matters because the Stripe
   * webhook can legitimately be delivered more than once.
   */
  async publish(event: DomainEvent, entityId: string): Promise<void> {
    await this.events.add(
      event,
      { entityId } satisfies DomainEventPayload,
      { ...DEFAULT_JOB_OPTIONS, jobId: `${event}:${entityId}` },
    );
    this.logger.log(`Published ${event} (${entityId})`);
  }
}
