import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { CommissionService } from './commission.service';
import { JOBS, QUEUES } from '../../queue/queue.constants';
import { reportDeadJob } from '../../queue/dead-job-alert';

@Processor(QUEUES.AFFILIATE_COMMISSION)
export class CommissionProcessor extends WorkerHost {
  private readonly logger = new Logger(CommissionProcessor.name);

  constructor(
    private readonly commissionService: CommissionService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    if (job.name === 'auto-confirm') {
      this.logger.log(`Auto-confirm job running: order=${job.data.orderId}`);
      await this.commissionService.confirmCommission(job.data.orderId);
      return;
    }

    if (job.name === JOBS.CREATE_ORDER_COMMISSION) {
      // Was a bare promise off the Stripe webhook with a .catch(log), so any
      // transient failure meant an affiliate silently never got credited.
      //
      // Safe to retry as-is: createForOrder looks up an existing commission by
      // orderId and returns early, so a second run is a no-op rather than a
      // second payout. That is why this one needed no idempotency work, unlike
      // the store-order credit.
      await this.commissionService.createForOrder(job.data.orderId);
      return;
    }

    this.logger.warn(`Unknown commission job: ${job.name}`);
  }

  /**
   * Every other processor had one of these; this one did not, which meant a
   * commission job that exhausted its retries went to the failed set without a
   * single line anywhere. Of all the jobs to lose silently, an affiliate payout
   * is the worst candidate — nobody notices an absent commission until the
   * affiliate asks.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(
      `Commission job failed: id=${job?.id} name=${job?.name} order=${job?.data?.orderId} attempt=${job?.attemptsMade} — ${error.message}`,
    );

    // Only once the retries are gone. The 'failed' event fires on every
    // attempt, so alerting here unconditionally would page on blips that the
    // next attempt fixes — and an alert that cries wolf gets muted, which is
    // worse than not having one.
    await reportDeadJob(job, error, { logger: this.logger, emailQueue: this.emailQueue });
  }
}
