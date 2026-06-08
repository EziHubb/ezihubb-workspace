import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOBS } from './queue.constants';

@Injectable()
export class QueueSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QueueSchedulerService.name);

  constructor(
    @InjectQueue(QUEUES.ABANDONED_CART) private readonly abandonedCartQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
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
}
