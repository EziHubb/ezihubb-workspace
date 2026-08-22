import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { LowStockService } from '../modules/products/low-stock.service';
import { QUEUES, JOBS } from './queue.constants';

@Processor(QUEUES.LOW_STOCK)
export class LowStockProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(LowStockProcessor.name);

  constructor(
    @InjectQueue(QUEUES.LOW_STOCK) private readonly queue: Queue,
    private readonly lowStockService: LowStockService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      const existing = await this.queue.getRepeatableJobs();
      if (!existing.some((j) => j.name === JOBS.DAILY_LOW_STOCK_SCAN)) {
        await this.queue.add(
          JOBS.DAILY_LOW_STOCK_SCAN,
          {},
          {
            repeat:           { pattern: '0 7 * * *' },
            removeOnComplete: { count: 100 },
            removeOnFail:     { count: 50 },
          },
        );
        this.logger.log('Scheduled daily low-stock scan: 7am UTC');
      }
    } catch (err) {
      this.logger.warn(`Failed to schedule low-stock scan: ${String(err)}`);
    }
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOBS.DAILY_LOW_STOCK_SCAN) {
      await this.lowStockService.dailyScan();
    } else if (job.name === JOBS.CHECK_ORDER_LOW_STOCK) {
      // Was a bare promise off the Stripe webhook. Read-and-alert, so a repeat
      // run costs at most a duplicate alert and never duplicate data.
      await this.lowStockService.checkAfterOrder(
        (job.data as { orderId: string }).orderId,
      );
    } else {
      this.logger.warn(`Unknown low-stock job: ${job.name}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug(`Low-stock job completed: id=${job.id} name=${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Low-stock job failed: id=${job.id} name=${job.name} — ${error.message}`,
    );
  }
}
