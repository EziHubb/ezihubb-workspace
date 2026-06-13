import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, AI_JOBS } from '../../queue/queue.constants';
import { PricingProcessor } from '../pricing/pricing.processor';
import { TrendsProcessor } from '../trends/trends.processor';
import { CreatorDnaProcessor } from '../creator-dna/creator-dna.processor';

@Processor(QUEUES.AI_FEATURES)
export class AiFeaturesProcessor extends WorkerHost {
  private readonly logger = new Logger(AiFeaturesProcessor.name);

  constructor(
    private readonly pricing:    PricingProcessor,
    private readonly trends:     TrendsProcessor,
    private readonly creatorDna: CreatorDnaProcessor,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing AI job: ${job.name} (id=${job.id})`);

    switch (job.name) {
      case AI_JOBS.ANALYZE_PRICING:
      case AI_JOBS.EVALUATE_AB_TEST:
      case AI_JOBS.RECORD_IMPRESSION:
      case AI_JOBS.RECORD_CONVERSION:
        return this.pricing.process(job);

      case AI_JOBS.FETCH_TRENDS:
      case AI_JOBS.GENERATE_DESIGN_BRIEF:
      case AI_JOBS.GENERATE_DESIGN_IMAGE:
      case AI_JOBS.EXPIRE_OLD_DRAFTS:
        return this.trends.process(job);

      case AI_JOBS.FETCH_SOCIAL_DATA:
      case AI_JOBS.ANALYZE_AUDIENCE:
        return this.creatorDna.process(job);

      default:
        this.logger.warn(`Unknown AI job: ${job.name}`);
        return null;
    }
  }
}
