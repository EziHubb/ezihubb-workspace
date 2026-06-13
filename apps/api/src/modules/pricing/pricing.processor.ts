import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_JOBS } from '../../queue/queue.constants';
import { PricingService } from './pricing.service';

@Injectable()
export class PricingProcessor {
  private readonly logger = new Logger(PricingProcessor.name);

  constructor(private readonly pricingService: PricingService) {}

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case AI_JOBS.ANALYZE_PRICING:
        this.logger.log(`Pricing: analyzing product ${job.data.productId}`);
        return this.pricingService.analyzePricing(job.data.productId as string, job.data.storeId as string);
      case AI_JOBS.EVALUATE_AB_TEST:
        this.logger.log('Pricing: resolving expired A/B tests');
        return this.pricingService.resolveExpiredTests();
      default:
        return null;
    }
  }
}
