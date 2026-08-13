import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOBS } from './queue.constants';

@Injectable()
export class QueueSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QueueSchedulerService.name);

  constructor(
    @InjectQueue(QUEUES.ABANDONED_CART) private readonly abandonedCartQueue: Queue,
    @InjectQueue(QUEUES.IMAGE_PROCESSING) private readonly imageQueue: Queue,
    @InjectQueue(QUEUES.SCHEDULED) private readonly scheduledQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all([
      this.scheduleAbandonedCartScan(),
      this.scheduleCleanupTempImages(),
      this.scheduleFlushSearchStats(),
    ]);
  }

  private async scheduleAbandonedCartScan(): Promise<void> {
    try {
      const existing = await this.abandonedCartQueue.getRepeatableJobs();
      if (!existing.some((j) => j.name === JOBS.SCAN_ABANDONED_CARTS)) {
        await this.abandonedCartQueue.add(
          JOBS.SCAN_ABANDONED_CARTS,
          {},
          {
            repeat:           { pattern: '*/30 * * * *' },
            removeOnComplete: { count: 100 },
            removeOnFail:     { count: 50  },
          },
        );
        this.logger.log('Scheduled abandoned-cart scan: every 30 minutes');
      }
    } catch (err) {
      this.logger.warn(`Failed to schedule abandoned-cart job: ${String(err)}`);
    }
  }

  private async scheduleCleanupTempImages(): Promise<void> {
    try {
      const existing = await this.imageQueue.getRepeatableJobs();
      if (!existing.some((j) => j.name === JOBS.CLEANUP_TEMP_IMAGES)) {
        await this.imageQueue.add(
          JOBS.CLEANUP_TEMP_IMAGES,
          {},
          {
            repeat:           { pattern: '0 3 * * *' }, // 3am UTC daily
            removeOnComplete: { count: 50 },
            removeOnFail:     { count: 20 },
            jobId:            'cleanup-temp-images-daily',
          },
        );
        this.logger.log('Scheduled temp-image cleanup: daily at 3am UTC');
      }
    } catch (err) {
      this.logger.warn(`Failed to schedule cleanup-temp-images job: ${String(err)}`);
    }
  }

  private async scheduleFlushSearchStats(): Promise<void> {
    try {
      const existing = await this.scheduledQueue.getRepeatableJobs();
      if (!existing.some((j) => j.name === JOBS.DAILY_FLUSH_SEARCH_STATS)) {
        await this.scheduledQueue.add(
          JOBS.DAILY_FLUSH_SEARCH_STATS,
          {},
          {
            repeat:           { pattern: '15 0 * * *' }, // 00:15 UTC daily — just past midnight
            removeOnComplete: { count: 30 },
            removeOnFail:     { count: 20 },
            jobId:            'daily-flush-search-stats',
          },
        );
        this.logger.log('Scheduled search-stats flush: daily at 00:15 UTC');
      }
    } catch (err) {
      this.logger.warn(`Failed to schedule daily-flush-search-stats job: ${String(err)}`);
    }
  }
}
