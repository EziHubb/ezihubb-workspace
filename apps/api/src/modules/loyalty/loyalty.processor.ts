import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LoyaltyService } from './loyalty.service';
import { QUEUES } from '../../queue/queue.constants';

@Processor(QUEUES.LOYALTY)
export class LoyaltyProcessor extends WorkerHost {
  private readonly logger = new Logger(LoyaltyProcessor.name);

  constructor(private readonly loyaltyService: LoyaltyService) {
    super();
  }

  async process(job: Job<{ orderId: string; userId: string }>): Promise<void> {
    if (job.name === 'loyalty-confirm') {
      this.logger.log(`Loyalty confirm job: order=${job.data.orderId}`);
      await this.loyaltyService.confirmPoints(job.data.orderId, job.data.userId);
    }
  }
}
