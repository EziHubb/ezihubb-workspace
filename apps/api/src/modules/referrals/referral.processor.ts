import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { ReferralService } from './referral.service';

@Processor(QUEUES.REFERRAL)
export class ReferralProcessor extends WorkerHost {
  private readonly logger = new Logger(ReferralProcessor.name);

  constructor(private readonly referralService: ReferralService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.REFERRAL_AUTO_CONFIRM: {
        const { orderId } = job.data as { orderId: string };
        this.logger.log(`Auto-confirming referral commissions for order ${orderId}`);
        await this.referralService.confirmCommissionsForOrder(orderId);
        break;
      }

      case JOBS.REFERRAL_CHECK_TIER: {
        const { userId } = job.data as { userId: string };
        await this.referralService.checkAndUpdateTier(userId);
        break;
      }

      default:
        this.logger.warn(`Unknown referral job: ${job.name}`);
    }
  }
}
