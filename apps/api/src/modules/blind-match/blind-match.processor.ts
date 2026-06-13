import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { BlindMatchService } from './blind-match.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor(QUEUES.BLIND_MATCH)
export class BlindMatchProcessor extends WorkerHost {
  constructor(
    private readonly blindMatchService: BlindMatchService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.BLIND_MATCH_PROCESS:
        await this.blindMatchService.processMatch(job.data.requestId);
        break;
      case JOBS.BLIND_MATCH_CREDIT:
        // $5 store credit issued — mark rating as refunded
        await this.prisma.blindMatchRating.updateMany({
          where: { requestId: job.data.requestId },
          data:  { buyerRefundIssued: true },
        });
        break;
    }
  }
}
