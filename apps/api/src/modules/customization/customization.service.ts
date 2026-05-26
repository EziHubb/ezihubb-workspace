import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import {
  QUEUES,
  JOBS,
  DEFAULT_JOB_OPTIONS,
  RemoveBackgroundJobData,
  GeneratePreviewJobData,
} from '../../queue/queue.constants';
import { UploadedImageDto } from './dto/upload-result.dto';
import { GeneratePreviewDto } from './dto/generate-preview.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { CustomizationDraft } from '@prisma/client';

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
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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
    if ((metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION) {
      buffer = await sharp(buffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      metadata = await sharp(buffer).metadata();
    } else if (file.mimetype !== 'image/webp') {
      // Convert to webp for consistent format
      buffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      metadata = await sharp(buffer).metadata();
    }

    const key = this.storage.generateKey('uploads/temp/customization', file.originalname.replace(/\.[^.]+$/, '.webp'));
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
    const outputKey = tempKey.replace('uploads/temp/', 'uploads/processed/bg-removed-');

    const job = await this.imageQueue.add(
      JOBS.REMOVE_BACKGROUND,
      {
        uploadKey: tempKey,
        outputKey,
        draftId,
      } satisfies RemoveBackgroundJobData,
      { ...DEFAULT_JOB_OPTIONS, timeout: 60_000 },
    );

    return { jobId: job.id as string };
  }

  // ── Job status ────────────────────────────────────────────────────────────────

  async getJobStatus(
    jobId: string,
  ): Promise<{ status: string; result?: string; error?: string }> {
    const job = await this.imageQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Job not found' });
    }

    const state = await job.getState();
    const returnValue = job.returnvalue as string | undefined;

    return {
      status: state,
      ...(returnValue !== undefined && { result: returnValue }),
      ...(job.failedReason && { error: job.failedReason }),
    };
  }

  // ── Preview generation ────────────────────────────────────────────────────────

  async generatePreview(dto: GeneratePreviewDto): Promise<{ jobId: string }> {
    const draft = await this.prisma.customizationDraft.findUnique({
      where: { id: dto.draftId },
      select: { id: true },
    });
    if (!draft) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Draft not found' });
    }

    const outputKey = `previews/customization/${dto.draftId}/${Date.now()}.png`;

    const job = await this.imageQueue.add(
      JOBS.GENERATE_PREVIEW,
      {
        draftId: dto.draftId,
        canvasData: dto.canvasData,
        outputKey,
      } satisfies GeneratePreviewJobData,
      { ...DEFAULT_JOB_OPTIONS, timeout: 30_000 },
    );

    return { jobId: job.id as string };
  }

  // ── Art style ─────────────────────────────────────────────────────────────────

  async applyArtStyle(
    tempKey: string,
    style: string,
    draftId: string,
  ): Promise<{ jobId: string }> {
    const outputKey = tempKey.replace('uploads/temp/', `uploads/processed/styled-${style}-`);

    const job = await this.imageQueue.add(
      JOBS.APPLY_ART_STYLE,
      { uploadKey: tempKey, outputKey, draftId, style },
      { ...DEFAULT_JOB_OPTIONS, timeout: 120_000 },
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
      throw new BadRequestException({ code: 'ERR_MISSING_IDENTITY', message: 'User or session required' });
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
          data: dto.data,
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
        data: dto.data,
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
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Draft not found' });
    }
    return draft;
  }
}
