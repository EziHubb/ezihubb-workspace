import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { ModerationSettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { TextModerationService } from './text-moderation.service';
import { ImageModerationService } from './image-moderation.service';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import type { ModerationResult } from './dto/moderation-result.dto';
import * as crypto from 'crypto';

const DAILY_CALLS_KEY  = () => `moderation:daily:calls:${new Date().toISOString().slice(0, 10)}`;
const DAILY_COST_KEY   = () => `moderation:daily:cost:${new Date().toISOString().slice(0, 10)}`;
const CONTENT_HASH_KEY = (hash: string) => `moderation:clean:${hash}`;
const SETTINGS_CACHE   = 'moderation:settings';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly redis:         RedisService,
    private readonly textService:   TextModerationService,
    private readonly imageService:  ImageModerationService,
    @InjectQueue(QUEUES.MODERATION) private readonly queue:       Queue,
    @InjectQueue(QUEUES.EMAIL)      private readonly emailQueue:  Queue,
  ) {}

  // ── Settings ──────────────────────────────────────────────────────────────

  private async getCachedSettings(): Promise<ModerationSettings> {
    const cached = await this.redis.get<ModerationSettings>(SETTINGS_CACHE);
    if (cached) return cached;
    const settings = await this.prisma.moderationSettings.upsert({
      where:  { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
    await this.redis.set(SETTINGS_CACHE, settings, 300);
    return settings;
  }

  private async invalidateSettingsCache() {
    await this.redis.del(SETTINGS_CACHE);
  }

  // ── Queue helpers ─────────────────────────────────────────────────────────

  async queueProductModeration(productId: string): Promise<void> {
    try {
      const product = await this.prisma.product.findUnique({
        where:  { id: productId },
        select: { id: true, name: true, description: true, storeId: true, images: { select: { url: true }, take: 5 } },
      });
      if (!product) return;

      const textJobs = [
        { fieldName: 'name',        content: product.name        },
        { fieldName: 'description', content: product.description },
      ];
      for (const { fieldName, content } of textJobs) {
        await this.queue.add(JOBS.CHECK_TEXT, {
          entityType: 'Product', entityId: productId, fieldName, content, storeId: product.storeId,
        }, { ...DEFAULT_JOB_OPTIONS, jobId: `mod_product_${productId}_${fieldName}` });
      }
      for (const img of product.images) {
        const hash = crypto.createHash('sha256').update(img.url).digest('hex').slice(0, 12);
        await this.queue.add(JOBS.CHECK_IMAGE, {
          entityType: 'Product', entityId: productId, imageUrl: img.url, storeId: product.storeId,
        }, { ...DEFAULT_JOB_OPTIONS, delay: 500, jobId: `mod_product_${productId}_img_${hash}` });
      }
    } catch (err) {
      this.logger.error('queueProductModeration failed', err);
    }
  }

  async queueStoreModeration(storeId: string): Promise<void> {
    try {
      const store = await this.prisma.store.findUnique({
        where:  { id: storeId },
        select: { id: true, name: true, description: true },
      });
      if (!store) return;

      const fields: { fieldName: string; content: string | null }[] = [
        { fieldName: 'name',        content: store.name        },
        { fieldName: 'description', content: store.description },
      ];
      for (const { fieldName, content } of fields) {
        if (!content) continue;
        await this.queue.add(JOBS.CHECK_TEXT, {
          entityType: 'Store', entityId: storeId, fieldName, content, storeId,
        }, { ...DEFAULT_JOB_OPTIONS, jobId: `mod_store_${storeId}_${fieldName}` });
      }
    } catch (err) {
      this.logger.error('queueStoreModeration failed', err);
    }
  }

  async queueReviewModeration(reviewId: string): Promise<void> {
    try {
      const review = await this.prisma.review.findUnique({
        where:  { id: reviewId },
        select: { id: true, title: true, body: true, storeId: true },
      });
      if (!review) return;

      const fields: { fieldName: string; content: string | null }[] = [
        { fieldName: 'title', content: review.title },
        { fieldName: 'body',  content: review.body  },
      ];
      for (const { fieldName, content } of fields) {
        if (!content) continue;
        await this.queue.add(JOBS.CHECK_TEXT, {
          entityType: 'Review', entityId: reviewId, fieldName, content, storeId: review.storeId,
        }, { ...DEFAULT_JOB_OPTIONS, jobId: `mod_review_${reviewId}_${fieldName}` });
      }
    } catch (err) {
      this.logger.error('queueReviewModeration failed', err);
    }
  }

  async queueMessageModeration(messageId: string): Promise<void> {
    try {
      const msg = await this.prisma.message.findUnique({
        where:  { id: messageId },
        select: { id: true, body: true, conversation: { select: { storeId: true } } },
      });
      if (!msg) return;

      await this.queue.add(JOBS.CHECK_TEXT, {
        entityType: 'Message', entityId: messageId, fieldName: 'body',
        content: msg.body, storeId: msg.conversation?.storeId,
      }, { ...DEFAULT_JOB_OPTIONS, delay: 3_000, jobId: `mod_message_${messageId}_body` });
    } catch (err) {
      this.logger.error('queueMessageModeration failed', err);
    }
  }

  async queueStoreImageModeration(storeId: string, imageUrl: string, imageType: 'banner' | 'logo'): Promise<void> {
    try {
      const hash = crypto.createHash('sha256').update(imageUrl).digest('hex').slice(0, 12);
      await this.queue.add(JOBS.CHECK_IMAGE, {
        entityType: 'Store', entityId: storeId, imageUrl, storeId,
      }, { ...DEFAULT_JOB_OPTIONS, delay: 500, jobId: `mod_store_${storeId}_${imageType}_${hash}` });
    } catch (err) {
      this.logger.error('queueStoreImageModeration failed', err);
    }
  }

  async queueReviewImageModeration(reviewId: string, imageUrls: string[], storeId: string | null): Promise<void> {
    try {
      for (const imageUrl of imageUrls) {
        const hash = crypto.createHash('sha256').update(imageUrl).digest('hex').slice(0, 12);
        await this.queue.add(JOBS.CHECK_IMAGE, {
          entityType: 'Review', entityId: reviewId, imageUrl, storeId,
        }, { ...DEFAULT_JOB_OPTIONS, delay: 500, jobId: `mod_review_${reviewId}_img_${hash}` });
      }
    } catch (err) {
      this.logger.error('queueReviewImageModeration failed', err);
    }
  }

  async queueQAModeration(questionId: string): Promise<void> {
    try {
      const q = await this.prisma.productQuestion.findUnique({
        where:  { id: questionId },
        select: { id: true, question: true, answer: true, product: { select: { storeId: true } } },
      });
      if (!q) return;
      const jobs: { fieldName: string; content: string | null }[] = [
        { fieldName: 'question', content: q.question },
        { fieldName: 'answer',   content: q.answer   },
      ];
      for (const { fieldName, content } of jobs) {
        if (!content) continue;
        await this.queue.add(JOBS.CHECK_TEXT, {
          entityType: 'ProductQuestion', entityId: questionId, fieldName, content,
          storeId: q.product?.storeId ?? null,
        }, { ...DEFAULT_JOB_OPTIONS, jobId: `mod_qa_${questionId}_${fieldName}` });
      }
    } catch (err) {
      this.logger.error('queueQAModeration failed', err);
    }
  }

  async queueUserAvatarModeration(userId: string, avatarUrl: string): Promise<void> {
    try {
      const hash = crypto.createHash('sha256').update(avatarUrl).digest('hex').slice(0, 12);
      await this.queue.add(JOBS.CHECK_IMAGE, {
        entityType: 'UserAvatar', entityId: userId, imageUrl: avatarUrl, storeId: null,
      }, { ...DEFAULT_JOB_OPTIONS, delay: 500, jobId: `mod_avatar_${userId}_${hash}` });
    } catch (err) {
      this.logger.error('queueUserAvatarModeration failed', err);
    }
  }

  // ── Core check ────────────────────────────────────────────────────────────

  async checkText(dto: {
    entityType: string;
    entityId:   string;
    fieldName:  string;
    content:    string;
    storeId?:   string | null;
  }): Promise<void> {
    const settings = await this.getCachedSettings();
    if (!settings.isEnabled) return;

    const hash = crypto.createHash('sha256').update(dto.content).digest('hex');

    // Check cache
    const cachedVerdict = await this.redis.get(CONTENT_HASH_KEY(hash));
    if (cachedVerdict === 'CLEAN') {
      await this.updateEntityStatus(dto.entityType, dto.entityId, 'CLEAN');
      return;
    }

    // Check daily limit
    const calls = parseInt(await this.redis.get(DAILY_CALLS_KEY()) ?? '0', 10);
    if (calls >= settings.maxDailyApiCalls) {
      this.logger.warn('Daily API call limit reached, deferring moderation');
      return;
    }

    // Quick keyword pre-check
    const rules = await this.getActiveRules();
    const quickResult = this.runLocalRules(dto.content, dto.entityType, rules);
    if (quickResult?.verdict === 'CRITICAL') {
      await this.saveAndApply({ ...dto, hash, result: quickResult });
      return;
    }

    // Call Claude
    const result = await this.textService.checkText(dto.content);
    await this.trackApiUsage(result);
    await this.saveAndApply({ ...dto, hash, result });
  }

  async checkImage(dto: {
    entityType: string;
    entityId:   string;
    imageUrl:   string;
    storeId?:   string | null;
  }): Promise<void> {
    const settings = await this.getCachedSettings();
    if (!settings.isEnabled || !settings.moderateImages) return;

    const hash = crypto.createHash('sha256').update(dto.imageUrl).digest('hex');
    const cachedVerdict = await this.redis.get(CONTENT_HASH_KEY(hash));
    if (cachedVerdict === 'CLEAN') return;

    const calls = parseInt(await this.redis.get(DAILY_CALLS_KEY()) ?? '0', 10);
    if (calls >= settings.maxDailyApiCalls) return;

    const result = await this.imageService.checkImage(dto.imageUrl);
    await this.trackApiUsage(result);
    await this.saveAndApply({
      entityType: dto.entityType, entityId: dto.entityId,
      fieldName: null, content: dto.imageUrl, hash, result,
      storeId: dto.storeId,
    });
  }

  // ── Apply result ──────────────────────────────────────────────────────────

  private async saveAndApply(dto: {
    entityType: string;
    entityId:   string;
    fieldName:  string | null;
    content:    string;
    hash:       string;
    result:     ModerationResult;
    storeId?:   string | null;
  }): Promise<void> {
    const settings = await this.getCachedSettings();
    const verdict   = this.mapVerdict(dto.result.verdict);
    const severity  = dto.result.verdict;

    // Save log
    const moderationLog = await this.prisma.moderationLog.create({
      data: {
        entityType:   dto.entityType,
        entityId:     dto.entityId,
        fieldName:    dto.fieldName,
        contentHash:  dto.hash,
        verdict,
        severity,
        categories:   dto.result.categories,
        confidence:   dto.result.confidence,
        reasoning:    dto.result.reasoning,
        sellerMessage: dto.result.sellerMessage,
        provider:     'claude',
        modelVersion: dto.result.modelVersion,
        latencyMs:    dto.result.latencyMs,
        triggeredBy:  'auto',
      },
    });

    await this.applyModerationResult(dto.entityType, dto.entityId, dto.result, dto.storeId, settings, moderationLog.id);

    // Cache CLEAN results
    if (dto.result.verdict === 'CLEAN') {
      const ttl = (settings.cacheCleanResultDays ?? 30) * 86400;
      await this.redis.set(CONTENT_HASH_KEY(dto.hash), 'CLEAN', ttl);
    }
  }

  async applyModerationResult(
    entityType: string,
    entityId:   string,
    result:     ModerationResult,
    storeId:    string | null | undefined,
    settings?:  ModerationSettings,
    logId?:     string,
  ): Promise<void> {
    const cfg = settings ?? await this.getCachedSettings();

    switch (result.verdict) {
      case 'CRITICAL':
        if (cfg.autoCriticalBlock) {
          await this.updateEntityStatus(entityType, entityId, 'REJECTED');
          if (storeId) await this.handleStrikes(storeId, 'CRITICAL', cfg, logId);
          await this.notifyAdminCritical(entityType, entityId, result);
          if (storeId) await this.notifySeller(storeId, entityType, result, 'content-rejected-critical');
        }
        break;

      case 'HIGH':
        if (cfg.autoHighFlag) {
          await this.updateEntityStatus(entityType, entityId, 'FLAGGED');
          if (storeId) await this.handleStrikes(storeId, 'HIGH', cfg, logId);
          if (storeId) await this.notifySeller(storeId, entityType, result, 'content-flagged');
        }
        break;

      case 'MEDIUM':
        if (cfg.autoMediumFlag) {
          await this.updateEntityStatus(entityType, entityId, 'FLAGGED');
          if (storeId) await this.notifySeller(storeId, entityType, result, 'content-flagged');
        }
        break;

      case 'LOW':
        await this.updateEntityStatus(entityType, entityId, 'CLEAN');
        if (cfg.autoLowWarn && storeId) {
          await this.notifySeller(storeId, entityType, result, 'content-warning');
        }
        break;

      default: // CLEAN
        await this.updateEntityStatus(entityType, entityId, 'CLEAN');
        break;
    }
  }

  private async updateEntityStatus(
    entityType: string,
    entityId:   string,
    status:     string,
  ): Promise<void> {
    try {
      const data = { moderationStatus: status as never, lastModeratedAt: new Date() };
      switch (entityType) {
        case 'Product': await this.prisma.product.update({ where: { id: entityId }, data }); break;
        case 'Store':   await this.prisma.store.update(  { where: { id: entityId }, data }); break;
        case 'Review':  await this.prisma.review.update( { where: { id: entityId }, data: { moderationStatus: status as never } }); break;
        case 'Message': await this.prisma.message.update({ where: { id: entityId }, data: { moderationStatus: status as never } }); break;
        case 'UserAvatar': /* No DB status field — violation logged only */ break;
        case 'ProductQuestion':
          await this.prisma.productQuestion.update({
            where: { id: entityId },
            data:  { isSpam: status === 'REJECTED' || status === 'FLAGGED' },
          });
          break;
      }
    } catch (err) {
      this.logger.error(`updateEntityStatus failed for ${entityType}:${entityId}`, err);
    }
  }

  // ── Strike system ─────────────────────────────────────────────────────────

  private async handleStrikes(
    storeId:  string,
    severity: string,
    settings: ModerationSettings,
    logId?:   string,
  ): Promise<void> {
    try {
      const windowDays  = settings.strikeWindowDays ?? 30;
      const windowStart = new Date(Date.now() - windowDays * 86400000);

      // Use the provided logId from the triggering moderation log, or fall back to the most recent log for this store
      const resolvedLogId = logId ?? (await this.prisma.moderationLog.findFirst({
        where:   { entityType: 'Store', entityId: storeId },
        orderBy: { createdAt: 'desc' },
        select:  { id: true },
      }))?.id ?? 'unknown';

      await this.prisma.strikeRecord.create({
        data: { storeId, severity, logId: resolvedLogId },
      });

      await this.prisma.store.update({
        where: { id: storeId },
        data:  { strikeCount: { increment: 1 } },
      });

      const [critStrikes, highStrikes] = await Promise.all([
        this.prisma.strikeRecord.count({ where: { storeId, severity: 'CRITICAL', createdAt: { gte: windowStart } } }),
        this.prisma.strikeRecord.count({ where: { storeId, severity: 'HIGH',     createdAt: { gte: windowStart } } }),
      ]);

      const critLimit = settings.strikeLimitCritical ?? 1;
      const highLimit = settings.strikeLimitHigh     ?? 3;

      if (severity === 'CRITICAL' && critStrikes >= critLimit) {
        await this.prisma.store.update({ where: { id: storeId }, data: { status: 'SUSPENDED' } });
        await this.prisma.product.updateMany({ where: { storeId }, data: { status: 'INACTIVE' } });
      } else if (severity === 'HIGH' && highStrikes >= highLimit) {
        const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { owner: { select: { email: true, firstName: true } } } });
        if (store?.owner) {
          await this.emailQueue.add(JOBS.SEND_EMAIL, {
            to:       store.owner.email,
            template: 'store-strike-warning',
            subject:  'Warning: Your store has received multiple content violations',
            data:     { sellerName: store.owner.firstName ?? 'Seller', strikeCount: highStrikes, windowDays, maxStrikes: highLimit },
          }, DEFAULT_JOB_OPTIONS);
        }
      }
    } catch (err) {
      this.logger.error('handleStrikes failed', err);
    }
  }

  // ── Admin actions ─────────────────────────────────────────────────────────

  async adminApprove(logId: string, adminId: string, notes: string): Promise<void> {
    const log = await this.prisma.moderationLog.findUniqueOrThrow({ where: { id: logId } });
    await this.prisma.moderationLog.update({
      where: { id: logId },
      data:  { reviewedBy: adminId, reviewedAt: new Date(), adminNotes: notes, verdict: 'APPROVED' },
    });
    await this.updateEntityStatus(log.entityType, log.entityId, 'APPROVED');
  }

  async adminReject(logId: string, adminId: string, notes: string): Promise<void> {
    const log = await this.prisma.moderationLog.findUniqueOrThrow({ where: { id: logId } });
    await this.prisma.moderationLog.update({
      where: { id: logId },
      data:  { reviewedBy: adminId, reviewedAt: new Date(), adminNotes: notes, verdict: 'REJECTED' },
    });
    await this.updateEntityStatus(log.entityType, log.entityId, 'REJECTED');
  }

  async reCheckContent(entityType: string, entityId: string): Promise<void> {
    switch (entityType) {
      case 'Product':         await this.queueProductModeration(entityId);   break;
      case 'Store':           await this.queueStoreModeration(entityId);     break;
      case 'Review':          await this.queueReviewModeration(entityId);    break;
      case 'Message':         await this.queueMessageModeration(entityId);   break;
      case 'ProductQuestion': await this.queueQAModeration(entityId);        break;
      case 'UserAvatar': {
        const user = await this.prisma.user.findUnique({ where: { id: entityId }, select: { avatarUrl: true } });
        if (user?.avatarUrl) await this.queueUserAvatarModeration(entityId, user.avatarUrl);
        break;
      }
    }
  }

  async sellerAppeal(entityType: string, entityId: string): Promise<void> {
    await this.updateEntityStatus(entityType, entityId, 'APPEALED');
  }

  async getQueue(query: {
    page?: number; limit?: number; severity?: string; entityType?: string;
  }) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 25;
    const where: Record<string, unknown> = {
      verdict: { in: ['FLAGGED', 'REJECTED', 'APPEALED'] },
      reviewedAt: null,
    };
    if (query.severity)   where.severity   = query.severity;
    if (query.entityType) where.entityType = query.entityType;

    const [data, total] = await Promise.all([
      this.prisma.moderationLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.moderationLog.count({ where }),
    ]);
    return { data, total, totalPages: Math.ceil(total / limit), page };
  }

  async getLogs(query: {
    page?: number; limit?: number; verdict?: string; entityType?: string;
  }) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 25;
    const where: Record<string, unknown> = {};
    if (query.verdict)    where.verdict    = query.verdict;
    if (query.entityType) where.entityType = query.entityType;

    const [data, total] = await Promise.all([
      this.prisma.moderationLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.moderationLog.count({ where }),
    ]);
    return { data, total, totalPages: Math.ceil(total / limit), page };
  }

  async getStats() {
    const [pending, critical, flaggedToday] = await Promise.all([
      this.prisma.moderationLog.count({ where: { verdict: { in: ['FLAGGED', 'APPEALED'] }, reviewedAt: null } }),
      this.prisma.moderationLog.count({ where: { severity: 'CRITICAL', reviewedAt: null } }),
      this.prisma.moderationLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) }, verdict: { not: 'CLEAN' } } }),
    ]);
    return { pending, critical, flaggedToday };
  }

  async getSettings() {
    return this.prisma.moderationSettings.upsert({
      where:  { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
  }

  async updateSettings(data: Record<string, unknown>) {
    await this.invalidateSettingsCache();
    return this.prisma.moderationSettings.update({ where: { id: 'singleton' }, data });
  }

  async getRules() {
    return this.prisma.moderationRule.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createRule(data: {
    name: string; description?: string; ruleType: string; value: string;
    severity: string; applyTo: string[]; createdBy: string;
  }) {
    return this.prisma.moderationRule.create({ data });
  }

  async updateRule(id: string, data: Partial<{ name: string; value: string; severity: string; isActive: boolean; applyTo: string[] }>) {
    return this.prisma.moderationRule.update({ where: { id }, data });
  }

  async deleteRule(id: string) {
    return this.prisma.moderationRule.delete({ where: { id } });
  }

  async getStoreViolations(storeId: string) {
    const logs = await this.prisma.moderationLog.findMany({
      where:   { entityType: { in: ['Product', 'Store', 'Review'] }, verdict: { not: 'CLEAN' } },
      orderBy: { createdAt: 'desc' },
    });
    const strikes = await this.prisma.strikeRecord.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } });
    return { logs, strikes };
  }

  async clearStrikes(storeId: string) {
    await this.prisma.strikeRecord.deleteMany({ where: { storeId } });
    await this.prisma.store.update({ where: { id: storeId }, data: { strikeCount: 0 } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private mapVerdict(v: string): 'PENDING' | 'CLEAN' | 'FLAGGED' | 'REJECTED' | 'APPEALED' | 'APPROVED' {
    switch (v) {
      case 'CLEAN':    return 'CLEAN';
      case 'LOW':      return 'CLEAN';
      case 'MEDIUM':   return 'FLAGGED';
      case 'HIGH':     return 'FLAGGED';
      case 'CRITICAL': return 'REJECTED';
      default:         return 'PENDING';
    }
  }

  private runLocalRules(
    content: string,
    entityType: string,
    rules: { ruleType: string; value: string; severity: string; applyTo: string[] }[],
  ): ModerationResult | null {
    for (const rule of rules) {
      if (!rule.applyTo.includes(entityType) && !rule.applyTo.includes('All')) continue;
      if (rule.ruleType !== 'KEYWORD') continue;
      if (content.toLowerCase().includes(rule.value.toLowerCase())) {
        return {
          verdict:       rule.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN',
          categories:    [rule.value],
          confidence:    1.0,
          reasoning:     `Matched local rule: ${rule.value}`,
          sellerMessage: `Your content contains prohibited content (${rule.value}).`,
          latencyMs:     0,
          modelVersion:  'local-rules',
        };
      }
    }
    return null;
  }

  private async getActiveRules(): Promise<{ ruleType: string; value: string; severity: string; applyTo: string[] }[]> {
    const cached = await this.redis.get<{ ruleType: string; value: string; severity: string; applyTo: string[] }[]>('moderation:rules');
    if (cached) return cached;
    const rules = await this.prisma.moderationRule.findMany({ where: { isActive: true } });
    await this.redis.set('moderation:rules', rules, 300);
    return rules;
  }

  private async trackApiUsage(result: ModerationResult) {
    const callsKey = DAILY_CALLS_KEY();
    const costKey  = DAILY_COST_KEY();
    await this.redis.increment(callsKey, 86400);
    const cost = 0.001;
    const existingCost = await this.redis.get<number>(costKey) ?? 0;
    await this.redis.set(costKey, existingCost + cost, 86400);
  }

  private async notifyAdminCritical(entityType: string, entityId: string, result: ModerationResult) {
    try {
      const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@dailydaisy.com';
      await this.emailQueue.add(JOBS.SEND_EMAIL, {
        to:       adminEmail,
        template: 'moderation-critical-alert',
        subject:  `CRITICAL: Content violation detected`,
        data:     { entityType, entityId, categories: result.categories.join(', '), confidence: (result.confidence * 100).toFixed(0), reasoning: result.reasoning },
      }, DEFAULT_JOB_OPTIONS);
    } catch (err) {
      this.logger.error('notifyAdminCritical failed', err);
    }
  }

  private async notifySeller(storeId: string, entityType: string, result: ModerationResult, template: string) {
    try {
      const store = await this.prisma.store.findUnique({
        where:  { id: storeId },
        select: { owner: { select: { email: true, firstName: true } } },
      });
      if (!store?.owner) return;
      await this.emailQueue.add(JOBS.SEND_EMAIL, {
        to:       store.owner.email,
        template,
        subject:  `Action required: Your content needs review — Daily Daisy`,
        data:     {
          sellerName:     store.owner.firstName ?? 'Seller',
          entityType,
          sellerMessage:  result.sellerMessage ?? 'Your content violates our policies.',
          contentPreview: '',
        },
      }, DEFAULT_JOB_OPTIONS);
    } catch (err) {
      this.logger.error('notifySeller failed', err);
    }
  }

  // Expose for tests
  async incr(key: string) { return this.redis.increment(key); }
}
