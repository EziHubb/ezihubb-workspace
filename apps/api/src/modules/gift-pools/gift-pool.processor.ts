import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { GiftPoolService } from './gift-pool.service';

@Processor(QUEUES.GIFT_POOLS)
export class GiftPoolProcessor extends WorkerHost {
  private readonly logger = new Logger(GiftPoolProcessor.name);

  constructor(private readonly giftPoolService: GiftPoolService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.GIFT_POOL_COMPLETE:
        this.logger.log(`Completing gift pool: poolId=${job.data.poolId}`);
        await this.giftPoolService.completePool(job.data.poolId);
        break;

      case JOBS.GIFT_POOL_EXPIRE:
        this.logger.log('Running gift pool expiry scan');
        await this.giftPoolService.expirePools();
        break;

      default:
        this.logger.warn(`Unhandled gift-pool job: ${job.name}`);
    }
  }
}
