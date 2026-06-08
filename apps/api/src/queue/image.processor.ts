import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
const sharp = require('sharp');
import axios from 'axios';

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

  async process(job: Job): Promise<string | undefined> {
    switch (job.name) {
      case JOBS.REMOVE_BACKGROUND:
        return this.handleRemoveBackground(job as Job<RemoveBackgroundJobData>);
      case JOBS.GENERATE_PREVIEW:
        return this.handleGeneratePreview(job as Job<GeneratePreviewJobData>);
      case JOBS.CLEANUP_TEMP_IMAGES:
        await this.handleCleanupTempImages();
        return undefined;
      default:
        this.logger.warn(`Unknown image job: ${job.name}`);
        return undefined;
    }
  }

  private async handleRemoveBackground(
    job: Job<RemoveBackgroundJobData>,
  ): Promise<string> {
    const { uploadKey, outputKey } = job.data;
    this.logger.log(`Remove background: ${uploadKey} → ${outputKey}`);

    const apiKey     = this.config.get<string>('BG_REMOVAL_API_KEY', '');
    const originalUrl = this.storage.getPublicUrl(uploadKey);

    if (!apiKey) {
      this.logger.warn('BG_REMOVAL_API_KEY not configured — returning original image');
      return originalUrl;
    }

    try {
      // Submit the CDN-hosted image URL to Remove.bg
      const params = new URLSearchParams({
        image_url: originalUrl,
        size:      'auto',
        type:      'product',   // optimised for product photos
        format:    'png',       // PNG preserves transparency
      });

      const response = await axios.post<ArrayBuffer>(
        'https://api.remove.bg/v1.0/removebg',
        params.toString(),
        {
          headers: {
            'X-Api-Key':    apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          responseType: 'arraybuffer',
          timeout:      30_000,
        },
      );

      const credits = response.headers['x-credits-remaining'];
      this.logger.log(`BG removal OK — credits remaining: ${credits ?? '?'}`);

      // Store as PNG (replace extension so key is unambiguous)
      const pngKey    = outputKey.replace(/\.\w+$/, '.png');
      const buffer    = Buffer.from(response.data);
      const resultUrl = await this.storage.uploadFile(buffer, pngKey, 'image/png');

      this.logger.log(`BG-removed image stored: ${pngKey}`);
      return resultUrl;

    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number }; message?: string };
      const status   = axiosErr.response?.status;

      if (status === 402) {
        this.logger.warn('Remove.bg quota exceeded — returning original image');
      } else if (status === 400) {
        this.logger.warn(`Remove.bg rejected image (400) — returning original`);
      } else {
        this.logger.error(`BG removal failed (${status ?? 'no response'}): ${axiosErr.message}`);
      }

      // Graceful fallback — caller gets original image URL, job still completes
      return originalUrl;
    }
  }

  private async handleGeneratePreview(
    job: Job<GeneratePreviewJobData>,
  ): Promise<string> {
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

    const resultUrl = await this.storage.uploadFile(placeholder, outputKey, 'image/png');
    this.logger.log(`Preview generated: ${outputKey}`);
    return resultUrl;
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
