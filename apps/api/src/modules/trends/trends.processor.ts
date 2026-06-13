import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_JOBS } from '../../queue/queue.constants';
import { TrendsService } from './trends.service';

@Injectable()
export class TrendsProcessor {
  private readonly logger = new Logger(TrendsProcessor.name);

  constructor(private readonly trendsService: TrendsService) {}

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case AI_JOBS.FETCH_TRENDS:
        this.logger.log('Trends: running daily generation for all stores');
        return this.trendsService.runDailyTrendGeneration();
      case AI_JOBS.GENERATE_DESIGN_BRIEF:
        this.logger.log(`Trends: generating drafts for store ${job.data.storeId}`);
        return this.trendsService.generateTrendDraftsForStore(job.data.storeId as string);
      case AI_JOBS.EXPIRE_OLD_DRAFTS:
        this.logger.log('Trends: expiring old drafts');
        return this.trendsService.expireOldDrafts();
      default:
        return null;
    }
  }
}
