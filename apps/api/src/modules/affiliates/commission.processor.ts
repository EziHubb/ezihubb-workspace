import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CommissionService } from './commission.service';
import { QUEUES } from '../../queue/queue.constants';

@Processor(QUEUES.AFFILIATE_COMMISSION)
export class CommissionProcessor extends WorkerHost {
  private readonly logger = new Logger(CommissionProcessor.name);

  constructor(private readonly commissionService: CommissionService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    if (job.name === 'auto-confirm') {
      this.logger.log(`Auto-confirm job running: order=${job.data.orderId}`);
      await this.commissionService.confirmCommission(job.data.orderId);
    }
  }
}
