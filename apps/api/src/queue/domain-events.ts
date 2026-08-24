import { JOBS, QUEUES, type JobName, type QueueName } from './queue.constants';

/**
 * Domain events, and who reacts to them.
 *
 * The point of this file is that publishers do not import it. A publisher says
 * "this happened" once; everything about who cares lives here. Adding a
 * consumer is an edit to the table below, never to the code that emits the
 * event — which is what stops the payment webhook from slowly accumulating a
 * hardcoded list of every side effect in the system, which is exactly what it
 * had become.
 */
export const DOMAIN_EVENTS = {
  /** A payment succeeded and the order is now confirmed. */
  ORDER_PAID: 'order.paid',
} as const;

export type DomainEvent = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

/**
 * Every domain event carries an entity id and nothing else.
 *
 * Deliberately minimal. A fat payload is a copy of the database taken at
 * publish time, and by the time a retried job runs it can disagree with the
 * row it describes — so consumers read what they need themselves, and always
 * see current state. It also means one event shape serves every consumer
 * instead of the union of everything any of them happens to want.
 */
export interface DomainEventPayload {
  entityId: string;
}

export interface EventSubscriber {
  queue: QueueName;
  job: JobName;
}

/**
 * The routing table. One entry per consumer of an event.
 *
 * Order is not significant: subscribers are independent and are dispatched
 * together. If two of them ever need sequencing, that is a sign they are one
 * consumer, not two.
 */
export const EVENT_SUBSCRIBERS: Record<DomainEvent, EventSubscriber[]> = {
  [DOMAIN_EVENTS.ORDER_PAID]: [
    // Confirms each seller's order and credits their revenue.
    { queue: QUEUES.ORDER_PROCESSING,     job: JOBS.CONFIRM_STORE_ORDERS },
    // Order status history + buyer confirmation email.
    { queue: QUEUES.ORDER_PROCESSING,     job: JOBS.ORDER_CONFIRMED },
    // Buyer-facing receipt / digital download mail.
    { queue: QUEUES.ORDER_PROCESSING,     job: JOBS.NOTIFY_BUYER_ORDER_PAID },
    // GA4 purchase event + internal analytics.
    { queue: QUEUES.ORDER_PROCESSING,     job: JOBS.TRACK_ORDER_ANALYTICS },
    // Affiliate commission, if the order carries an affiliate.
    { queue: QUEUES.AFFILIATE_COMMISSION, job: JOBS.CREATE_ORDER_COMMISSION },
    // Alerts the seller if this order took stock below their threshold.
    { queue: QUEUES.LOW_STOCK,            job: JOBS.CHECK_ORDER_LOW_STOCK },
  ],
};

/**
 * Builds a BullMQ custom job id.
 *
 * The separator is not cosmetic: BullMQ rejects any custom id containing ':'
 * with "Custom Id cannot contain :", because that character separates its own
 * Redis keys. Every id here used to be joined with ':', so `queue.add` threw
 * before the job was ever created.
 *
 * Nothing degraded quietly — it took the caller down with it. The Stripe
 * webhook answered 500, ORDER_PAID was never published, and none of its six
 * subscribers ran: each seller's StoreOrder stayed PENDING_PAYMENT and so
 * never appeared in their Orders queue, no seller notification went out, and
 * no analytics or commission were recorded. Paid orders simply vanished.
 *
 * Colons in the parts themselves are stripped too, since an id assembled from
 * caller-supplied values must not be able to reintroduce the same failure.
 */
export const jobIdOf = (...parts: (string | number)[]): string =>
  parts.map((p) => String(p).replace(/:/g, '-')).join('--');

/**
 * Deterministic id for a dispatched subscriber job.
 *
 * This is what makes the dispatcher safe to retry. Fan-out is not atomic: it
 * can enqueue three of six subscribers and then die. The retry re-dispatches
 * all six, and BullMQ drops the three that already exist because their ids
 * match — so no subscriber is skipped and none runs twice, without the
 * dispatcher having to track how far it got.
 */
export const subscriberJobId = (event: DomainEvent, job: JobName, entityId: string) =>
  jobIdOf(event, job, entityId);
