import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import axios from 'axios';

import { ConfigService } from '@nestjs/config';
import Replicate from 'replicate';
import { StorageService } from '../common/services/storage.service';
import { RedisService } from '../common/services/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ART_STYLES } from '../modules/customization/art-styles.config';
import type { ArtStyleJobStatus } from '../modules/customization/art-style.service';
import {
  QUEUES,
  JOBS,
  RemoveBackgroundJobData,
  ApplyArtStyleJobData,
} from './queue.constants';

const CLEANUP_BATCH_SIZE = 100;

@Processor(QUEUES.IMAGE_PROCESSING)
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  private readonly replicate: Replicate | null = null;

  constructor(
    private readonly config:   ConfigService,
    private readonly storage:  StorageService,
    private readonly redis:    RedisService,
    private readonly prisma:   PrismaService,
  ) {
    super();
    const token = this.config.get<string>('REPLICATE_API_TOKEN');
    if (token) this.replicate = new Replicate({ auth: token });
  }

  async process(job: Job): Promise<string | undefined> {
    switch (job.name) {
      case JOBS.REMOVE_BACKGROUND:
        return this.handleRemoveBackground(job as Job<RemoveBackgroundJobData>);
      case JOBS.APPLY_ART_STYLE:
        await this.handleApplyArtStyle(job as Job<ApplyArtStyleJobData>);
        return undefined;
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

  private async handleApplyArtStyle(job: Job<ApplyArtStyleJobData>): Promise<void> {
    const { jobId, imageKey, styleId } = job.data;
    this.logger.log(`Apply art style: jobId=${jobId} style=${styleId} key=${imageKey}`);

    const setStatus = (val: ArtStyleJobStatus, ttl: number) =>
      this.redis.set(`job:artstyle:${jobId}`, val, ttl);

    const style = ART_STYLES.find((s) => s.id === styleId);
    if (!style || !this.replicate) {
      await setStatus({ status: 'failed', error: 'Style not found or Replicate not configured' }, 300);
      return;
    }

    try {
      const imageUrl = this.storage.getPublicUrl(imageKey);

      const output = await this.replicate.run(
        `${style.replicateModel}:${style.replicateVersion}` as `${string}/${string}:${string}`,
        { input: { image: imageUrl, ...style.defaultInput } },
      );

      const resultUrl = Array.isArray(output)
        ? (output[0] as unknown as string)
        : (output as unknown as string);
      if (!resultUrl || typeof resultUrl !== 'string') throw new Error('No output URL from Replicate');

      // Re-upload to R2 — Replicate URLs expire after 1h
      const resp   = await fetch(resultUrl);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const r2Key  = `art-styles/${styleId}/${Date.now()}.webp`;
      const permanentUrl = await this.storage.uploadFile(buffer, r2Key, 'image/webp');

      await setStatus({ status: 'done', processedKey: r2Key, processedUrl: permanentUrl, styleId }, 600);
      this.logger.log(`Art style done: jobId=${jobId} style=${styleId}`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Art style failed: jobId=${jobId} — ${msg}`);
      await setStatus({ status: 'failed', error: 'Art style processing failed. Please try again.' }, 300);
    }
  }

  private async handleCleanupTempImages(): Promise<{ deleted: number; errors: number }> {
    this.logger.log('Cleanup temp images: started');

    const expiredDrafts = await this.prisma.customizationDraft.findMany({
      where: {
        expiresAt: { lt: new Date() },
        previewUrl: { not: null },
      },
      select: { id: true, previewUrl: true },
      take: CLEANUP_BATCH_SIZE,
    });

    if (expiredDrafts.length === 0) {
      this.logger.log('Cleanup temp images: no expired drafts found');
      return { deleted: 0, errors: 0 };
    }

    let deleted = 0;
    let errors = 0;

    for (const draft of expiredDrafts) {
      try {
        if (draft.previewUrl) {
          const key = this.storage.extractKey(draft.previewUrl);
          await this.storage.deleteFile(key);
          deleted++;
        }

        await this.prisma.customizationDraft.update({
          where: { id: draft.id },
          data: { previewUrl: null },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to clean up draft ${draft.id}: ${msg}`);
        errors++;
      }
    }

    this.logger.log(`Cleanup temp images: ${deleted} deleted, ${errors} errors`);
    return { deleted, errors };
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
