import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_JOBS } from '../../queue/queue.constants';
import { CreatorDnaService } from './creator-dna.service';

@Injectable()
export class CreatorDnaProcessor {
  private readonly logger = new Logger(CreatorDnaProcessor.name);

  constructor(private readonly creatorDnaService: CreatorDnaService) {}

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case AI_JOBS.FETCH_SOCIAL_DATA:
      case AI_JOBS.ANALYZE_AUDIENCE:
        this.logger.log(`CreatorDNA: running analysis for user ${job.data.userId}`);
        return this.creatorDnaService.runAnalysis(job.data.userId as string, job.data.platform as string);
      default:
        return null;
    }
  }
}
