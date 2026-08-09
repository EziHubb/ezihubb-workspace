import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
const sharp = require('sharp');

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { RedisService } from '../../common/services/redis.service';
import type { ArtStyleJobStatus } from './art-style.service';
import {
  QUEUES,
  JOBS,
  DEFAULT_JOB_OPTIONS,
  RemoveBackgroundJobData,
} from '../../queue/queue.constants';
import { UploadedImageDto } from './dto/upload-result.dto';
import { GenerateFieldsPreviewDto } from './dto/generate-fields-preview.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { CustomizationDraft } from '@prisma/client';
import { TemplateCompositorService } from './template-compositor.service';
import { DEMO_TEMPLATE, PreviewFieldValue } from '@ezihubb/types';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 3000;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
]);
const DRAFT_TTL_HOURS = 72;

@Injectable()
export class CustomizationService {
  private readonly logger = new Logger(CustomizationService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly storage:    StorageService,
    private readonly redis:      RedisService,
    private readonly compositor: TemplateCompositorService,
    @InjectQueue(QUEUES.IMAGE_PROCESSING) private readonly imageQueue: Queue,
  ) {}

  // ── Image upload ──────────────────────────────────────────────────────────────

  async uploadImage(file: Express.Multer.File): Promise<UploadedImageDto> {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException({
        code: 'ERR_FILE_TOO_LARGE',
        message: 'Image must be smaller than 10 MB',
      });
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'ERR_FILE_TYPE_INVALID',
        message: 'Only JPEG, PNG, WebP and HEIC images are supported',
      });
    }

    let buffer = file.buffer;
    let metadata = await sharp(buffer).metadata();

    // Resize if either dimension exceeds MAX_DIMENSION
    if (
      (metadata.width ?? 0) > MAX_DIMENSION ||
      (metadata.height ?? 0) > MAX_DIMENSION
    ) {
      buffer = await sharp(buffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
      metadata = await sharp(buffer).metadata();
    } else if (file.mimetype !== 'image/webp') {
      // Convert to webp for consistent format
      buffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      metadata = await sharp(buffer).metadata();
    }

    const key = this.storage.generateKey(
      'uploads/temp/customization',
      file.originalname.replace(/\.[^.]+$/, '.webp'),
    );
    await this.storage.uploadFile(buffer, key, 'image/webp');
    const url = this.storage.getPublicUrl(key);

    return {
      tempKey: key,
      tempUrl: url,
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      originalName: file.originalname,
      sizeBytes: buffer.length,
    };
  }

  // ── Background removal ────────────────────────────────────────────────────────

  async removeBackground(
    tempKey: string,
    draftId: string,
  ): Promise<{ jobId: string }> {
    const outputKey = tempKey.replace(
      'uploads/temp/',
      'uploads/processed/bg-removed-',
    );

    const job = await this.imageQueue.add(
      JOBS.REMOVE_BACKGROUND,
      {
        uploadKey: tempKey,
        outputKey,
        draftId,
      } satisfies RemoveBackgroundJobData,
      DEFAULT_JOB_OPTIONS,
    );

    return { jobId: job.id as string };
  }

  // ── Job status ────────────────────────────────────────────────────────────────

  async getJobStatus(jobId: string): Promise<{
    status: string;
    processedKey?: string;
    processedUrl?: string;
    error?: string;
  }> {
    // Art-style jobs use Redis (custom jobId starting with 'artstyle_')
    if (jobId.startsWith('artstyle_')) {
      const data = await this.redis.get<ArtStyleJobStatus>(`job:artstyle:${jobId}`);
      if (!data) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Job not found' });
      return {
        status:       data.status,
        processedKey: data.processedKey,
        processedUrl: data.processedUrl,
        error:        data.error,
      };
    }

    // All other image-processing jobs use BullMQ state
    const job = await this.imageQueue.getJob(jobId);
    if (!job) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Job not found' });

    const state       = await job.getState();
    const returnValue = job.returnvalue as string | undefined;

    // Map BullMQ states to the shape the client expects
    const clientStatus =
      state === 'completed' ? 'done'
      : state === 'failed'  ? 'failed'
      : 'processing';

    return {
      status:       clientStatus,
      processedUrl: returnValue,
      ...(job.failedReason && { error: job.failedReason }),
    };
  }

  // ── Preview generation ────────────────────────────────────────────────────────
  // Fast (Sharp compositing only, no external AI call) so this runs synchronously
  // rather than through the job queue used for background-removal/art-style.
  //
  // TODO: only DEMO_TEMPLATE can be rendered today — there's no admin UI yet to
  // author a real per-product template, and Product/ProductDetail don't expose
  // one in the shape TemplateCompositorService expects. Tracked as follow-up work.

  async generateFieldsPreview(dto: GenerateFieldsPreviewDto): Promise<{ previewUrl: string }> {
    if (dto.templateId !== DEMO_TEMPLATE.id) {
      throw new NotFoundException({
        code: 'ERR_TEMPLATE_NOT_FOUND',
        message: `Template "${dto.templateId}" is not available for preview yet`,
      });
    }

    const buffer = await this.compositor.composite(
      DEMO_TEMPLATE,
      dto.fields as Record<string, PreviewFieldValue | undefined>,
      (key) => this.storage.getPublicUrl(key),
    );

    const outputKey = this.storage.generateKey('previews/customization', 'preview.png');
    await this.storage.uploadFile(buffer, outputKey, 'image/png');

    return { previewUrl: this.storage.getPublicUrl(outputKey) };
  }

  // ── Art style ─────────────────────────────────────────────────────────────────

  async applyArtStyle(
    tempKey: string,
    style: string,
    draftId: string,
  ): Promise<{ jobId: string }> {
    const outputKey = tempKey.replace(
      'uploads/temp/',
      `uploads/processed/styled-${style}-`,
    );

    const job = await this.imageQueue.add(
      JOBS.APPLY_ART_STYLE,
      { uploadKey: tempKey, outputKey, draftId, style },
      DEFAULT_JOB_OPTIONS,
    );

    return { jobId: job.id as string };
  }

  // ── Draft CRUD ────────────────────────────────────────────────────────────────

  async saveCustomizationDraft(
    userId: string | null,
    sessionId: string | null,
    dto: SaveDraftDto,
  ): Promise<CustomizationDraft> {
    if (!userId && !sessionId) {
      throw new BadRequestException({
        code: 'ERR_MISSING_IDENTITY',
        message: 'User or session required',
      });
    }

    const expiresAt = new Date(Date.now() + DRAFT_TTL_HOURS * 60 * 60 * 1_000);

    // Upsert: one draft per user/session + product + template
    const existing = await this.prisma.customizationDraft.findFirst({
      where: {
        ...(userId ? { userId } : { sessionId }),
        productId: dto.productId,
        templateId: dto.templateId,
      },
    });

    if (existing) {
      return this.prisma.customizationDraft.update({
        where: { id: existing.id },
        data: {
          variantId: dto.variantId ?? null,
          data: dto.data as any,
          uploadedImages: dto.uploadedImages ?? [],
          previewUrl: dto.previewUrl ?? existing.previewUrl,
          expiresAt,
        },
      });
    }

    return this.prisma.customizationDraft.create({
      data: {
        userId,
        sessionId,
        productId: dto.productId,
        templateId: dto.templateId,
        variantId: dto.variantId ?? null,
        data: dto.data as any,
        uploadedImages: dto.uploadedImages ?? [],
        previewUrl: dto.previewUrl ?? null,
        expiresAt,
      },
    });
  }

  async getLastCustomization(
    userId: string | null,
    sessionId: string | null,
    productId: string,
  ): Promise<CustomizationDraft | null> {
    if (!userId && !sessionId) return null;

    return this.prisma.customizationDraft.findFirst({
      where: {
        ...(userId ? { userId } : { sessionId }),
        productId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDraftById(draftId: string): Promise<CustomizationDraft> {
    const draft = await this.prisma.customizationDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft) {
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Draft not found',
      });
    }
    return draft;
  }
}
