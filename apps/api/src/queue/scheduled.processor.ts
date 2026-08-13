import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AnalyticsService } from '../modules/analytics/analytics.service';
import { QUEUES, JOBS } from './queue.constants';

@Processor(QUEUES.SCHEDULED)
export class ScheduledProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledProcessor.name);

  constructor(private readonly analyticsService: AnalyticsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.DAILY_FLUSH_SEARCH_STATS:
        await this.handleFlushSearchStats();
        return;
      default:
        this.logger.warn(`Unknown scheduled job: ${job.name}`);
    }
  }

  /**
   * Folds yesterday's Redis search counters (volume/results/clicks — see
   * AnalyticsService.trackSearch/trackSearchClick) into durable
   * SearchTermDailyStat rows, then prunes rows older than the 90-day
   * retention window. Runs once daily shortly after midnight UTC, so
   * "yesterday" is the day that just fully completed.
   */
  private async handleFlushSearchStats(): Promise<void> {
    const yesterday = this.dateStr(this.subDays(new Date(), 1));
    this.logger.log(`Flushing search stats for ${yesterday}`);

    const { termsFlushed } = await this.analyticsService.flushDailySearchStats(yesterday);
    const { deleted } = await this.analyticsService.cleanupOldSearchStats();

    this.logger.log(
      `Search stats flush done: ${termsFlushed} terms for ${yesterday}, ${deleted} stale rows pruned`,
    );
  }

  // Must stay UTC-explicit, matching AnalyticsService's own dateStr/subDays —
  // flushDailySearchStats compares this date string against OrderItem
  // timestamps using explicit UTC boundaries, so "yesterday" here and there
  // have to agree regardless of the container's TZ setting.
  private dateStr(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private subDays(d: Date, days: number): Date {
    const result = new Date(d);
    result.setUTCDate(result.getUTCDate() - days);
    return result;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug(`Scheduled job completed: id=${job.id} name=${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Scheduled job failed: id=${job.id} name=${job.name} attempt=${job.attemptsMade} — ${error.message}`,
    );
  }
}
