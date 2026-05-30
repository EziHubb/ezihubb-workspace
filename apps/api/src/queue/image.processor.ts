import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
const sharp = require('sharp');

import { ConfigService } from '@nestjs/config';
import { StorageService } from '../common/services/storage.service';
import {
  QUEUES,
  JOBS,
  RemoveBackgroundJobData,
  GeneratePreviewJobData,
} from './queue.constants';

@Processor(QUEUES.IMAGE_PROCESSING)
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.REMOVE_BACKGROUND:
        await this.handleRemoveBackground(job as Job<RemoveBackgroundJobData>);
        break;
      case JOBS.GENERATE_PREVIEW:
        await this.handleGeneratePreview(job as Job<GeneratePreviewJobData>);
        break;
      case JOBS.CLEANUP_TEMP_IMAGES:
        await this.handleCleanupTempImages();
        break;
      default:
        this.logger.warn(`Unknown image job: ${job.name}`);
    }
  }

  private async handleRemoveBackground(
    job: Job<RemoveBackgroundJobData>,
  ): Promise<void> {
    const { uploadKey, outputKey } = job.data;
    this.logger.log(`Remove background: ${uploadKey} → ${outputKey}`);

    const bgRemovalUrl = this.config.get<string>('BG_REMOVAL_API_URL');
    const bgRemovalKey = this.config.get<string>('BG_REMOVAL_API_KEY');

    if (!bgRemovalUrl || !bgRemovalKey) {
      this.logger.warn(
        'BG_REMOVAL_API_URL / BG_REMOVAL_API_KEY not configured — skipping',
      );
      return;
    }

    // TODO: call external AI background removal service
    // const signedUrl = await this.storage.getSignedUrl(uploadKey);
    // const result = await callBgRemovalApi(signedUrl, bgRemovalUrl, bgRemovalKey);
    // await this.storage.uploadFile(result.buffer, outputKey, 'image/png');
    this.logger.log(`Background removed: ${outputKey}`);
  }

  private async handleGeneratePreview(
    job: Job<GeneratePreviewJobData>,
  ): Promise<void> {
    const { draftId, outputKey } = job.data;
    this.logger.log(`Generate preview: draftId=${draftId} → ${outputKey}`);

    // Placeholder: composite canvas data onto a blank image using Sharp
    const placeholder = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    await this.storage.uploadFile(placeholder, outputKey, 'image/png');
    this.logger.log(`Preview generated: ${outputKey}`);
  }

  private async handleCleanupTempImages(): Promise<void> {
    this.logger.log('Cleanup temp images: started');
    // TODO: query DB for CustomizationDraft records where
    //       expiresAt < now AND previewUrl IS NOT NULL,
    //       delete the S3 objects, then update records
    this.logger.log('Cleanup temp images: completed');
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug(`Image job completed: id=${job.id} name=${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Image job failed: id=${job.id} name=${job.name} attempt=${job.attemptsMade} — ${error.message}`,
    );
  }
}
