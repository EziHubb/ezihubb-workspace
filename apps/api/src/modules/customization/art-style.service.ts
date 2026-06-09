import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Replicate from 'replicate';
import { StorageService } from '../../common/services/storage.service';
import { RedisService } from '../../common/services/redis.service';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { ART_STYLES, ART_STYLE_IDS } from './art-styles.config';

export interface ArtStyleJobStatus {
  status: 'processing' | 'done' | 'failed';
  processedKey?: string;
  processedUrl?: string;
  error?: string;
  styleId?: string;
}

const REDIS_TTL = 600; // 10 min

@Injectable()
export class ArtStyleService {
  private readonly logger = new Logger(ArtStyleService.name);
  readonly replicate: Replicate | null = null;

  constructor(
    private readonly config:   ConfigService,
    private readonly storage:  StorageService,
    private readonly redis:    RedisService,
    @InjectQueue(QUEUES.IMAGE_PROCESSING) private readonly imageQueue: Queue,
  ) {
    const token = this.config.get<string>('REPLICATE_API_TOKEN');
    if (token) {
      this.replicate = new Replicate({ auth: token });
    } else {
      this.logger.warn('REPLICATE_API_TOKEN not set — art style endpoint returns 400');
    }
  }

  getAvailableStyles() {
    return ART_STYLES.map(({ id, label, description, previewUrl }) => ({
      id, label, description, previewUrl,
    }));
  }

  async startJob(imageKey: string, styleId: string): Promise<{ jobId: string; estimatedSeconds: number }> {
    if (!ART_STYLE_IDS.has(styleId)) {
      throw new BadRequestException(`Unknown art style: ${styleId}`);
    }
    if (!this.replicate) {
      throw new BadRequestException('Art style service is not configured (REPLICATE_API_TOKEN missing)');
    }

    const jobId = `artstyle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await this.redis.set(
      `job:artstyle:${jobId}`,
      { status: 'processing', styleId },
      REDIS_TTL,
    );

    await this.imageQueue.add(
      JOBS.APPLY_ART_STYLE,
      { jobId, imageKey, styleId },
      DEFAULT_JOB_OPTIONS,
    );

    return { jobId, estimatedSeconds: 30 };
  }

  async getJobResult(jobId: string): Promise<ArtStyleJobStatus | null> {
    return this.redis.get<ArtStyleJobStatus>(`job:artstyle:${jobId}`);
  }

  async processJob(jobId: string, imageKey: string, styleId: string): Promise<void> {
    const style = ART_STYLES.find((s) => s.id === styleId);
    if (!style || !this.replicate) {
      await this.setFailed(jobId, 'Style not found or Replicate not configured');
      return;
    }

    const imageUrl = this.storage.getPublicUrl(imageKey);

    try {
      const output = await this.replicate.run(
        `${style.replicateModel}:${style.replicateVersion}` as `${string}/${string}:${string}`,
        {
          input: {
            image: imageUrl,
            ...style.defaultInput,
          },
        },
      );

      const resultUrl = Array.isArray(output)
        ? (output[0] as unknown as string)
        : (output as unknown as string);
      if (!resultUrl || typeof resultUrl !== 'string') {
        throw new Error('No output URL from Replicate');
      }

      // Fetch and re-upload to R2 — Replicate URLs expire after 1h
      const resp   = await fetch(resultUrl);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const r2Key  = `art-styles/${styleId}/${Date.now()}.webp`;
      const permanentUrl = await this.storage.uploadFile(buffer, r2Key, 'image/webp');

      await this.redis.set(
        `job:artstyle:${jobId}`,
        { status: 'done', processedKey: r2Key, processedUrl: permanentUrl, styleId },
        REDIS_TTL,
      );

      this.logger.log(`Art style done: jobId=${jobId} style=${styleId} key=${r2Key}`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Art style failed: jobId=${jobId} — ${msg}`);
      await this.setFailed(jobId, 'Art style processing failed. Please try again.');
    }
  }

  private async setFailed(jobId: string, error: string): Promise<void> {
    await this.redis.set(
      `job:artstyle:${jobId}`,
      { status: 'failed', error },
      300,
    );
  }
}
