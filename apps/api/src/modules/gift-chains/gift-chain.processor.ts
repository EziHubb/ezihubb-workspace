import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { GiftChainService } from './gift-chain.service';

@Processor(QUEUES.GIFT_CHAINS)
export class GiftChainProcessor extends WorkerHost {
  constructor(private readonly giftChainService: GiftChainService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.GIFT_CHAIN_NUDGE:
        // Send nudge email - handled by NotificationsModule in production
        break;
      case JOBS.GIFT_CHAIN_CLOSE:
        await this.giftChainService.closeInactiveChains();
        break;
    }
  }
}
