import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, JOBS, CheckTextJobData, CheckImageJobData } from '../../queue/queue.constants';
import { ModerationService } from './moderation.service';

@Processor(QUEUES.MODERATION, { concurrency: 10 })
export class ModerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ModerationProcessor.name);

  constructor(private readonly moderation: ModerationService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOBS.CHECK_TEXT) {
      const data = job.data as CheckTextJobData;
      await this.moderation.checkText(data);
    } else if (job.name === JOBS.CHECK_IMAGE) {
      const data = job.data as CheckImageJobData;
      await this.moderation.checkImage(data);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed: ${err.message}`);
  }
}
