import { ServiceUnavailableException } from '@nestjs/common';

/** A durable operation exists or classification failed. Do not acknowledge lost work. */
export class EconomicWebhookRetryException extends ServiceUnavailableException {
  constructor() { super('Economic payment evidence has not been committed; retry or reconcile the existing operation'); }
}
