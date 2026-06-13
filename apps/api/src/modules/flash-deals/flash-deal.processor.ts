import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JOBS, QUEUES } from '../../queue/queue.constants';
import { FlashDealService } from './flash-deal.service';

@Processor(QUEUES.FLASH_DEALS)
export class FlashDealProcessor extends WorkerHost {
  constructor(private readonly flashDealService: FlashDealService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOBS.FLASH_DEAL_ACTIVATE || job.name === JOBS.FLASH_DEAL_END) {
      await this.flashDealService.scheduleDeals();
    }
  }
}
