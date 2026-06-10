import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, JOBS } from './queue.constants';
import { AutoTranslateService, type TranslateEntityJobData } from '../modules/translations/auto-translate.service';

@Processor(QUEUES.TRANSLATIONS)
export class TranslationProcessor extends WorkerHost {
  private readonly logger = new Logger(TranslationProcessor.name);

  constructor(private readonly autoTranslate: AutoTranslateService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOBS.TRANSLATE_ENTITY) {
      const data = job.data as TranslateEntityJobData;
      this.logger.log(
        `Processing translation job for ${data.entityType}:${data.entityId} → [${data.locales.join(', ')}]`,
      );
      await this.autoTranslate.translateEntity(
        data.entityType as Parameters<AutoTranslateService['translateEntity']>[0],
        data.entityId,
        data.sourceData,
        data.locales,
        data.forceRetranslate,
      );
    }
  }
}
