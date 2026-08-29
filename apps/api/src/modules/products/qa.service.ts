import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginatedResponse } from '../../common/dto/paginated-response.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class AskQuestionDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MaxLength(500) question: string;
}

export class AnswerQuestionDto {
  @IsString() @MaxLength(5000) answer: string;
  @IsOptional() publish?: boolean;
}

export interface AdminQuestionInboxQuery {
  filter?: 'all' | 'unanswered' | 'answered';
  q?: string;
  page?: number;
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly moderationService?: ModerationService,
  ) {}

  // ── Customer: ask a question ─────────────────────────────────────────────────

  async askQuestion(productSlug: string, dto: AskQuestionDto) {
    const product = await this.prisma.product.findFirst({
      where:  { slug: productSlug },
      select: { id: true, name: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const q = await this.prisma.productQuestion.create({
      data: {
        productId:   product.id,
        question:    dto.question.trim(),
        askedByName: dto.name.trim(),
        askedByEmail: dto.email,
      },
    });

    this.logger.log(`New question on product ${product.id}: "${q.question.slice(0, 60)}"`);
    this.moderationService?.queueQAModeration(q.id).catch((e: Error) => this.logger.error('qa mod queue failed', e));
    return { id: q.id, message: "Question submitted! We'll answer it soon." };
  }

  // ── Public: get published Q&As ───────────────────────────────────────────────

  async getPublishedQAs(productSlug: string) {
    const product = await this.prisma.product.findFirst({
      where:  { slug: productSlug },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const questions = await this.prisma.productQuestion.findMany({
      // Buyer questions are public immediately. isPublished controls whether
      // the shop's answer is public; isSpam controls question visibility.
      where: { productId: product.id, isSpam: false },
      select: {
        id:          true,
        question:    true,
        askedByName: true,
        answer:      true,
        answeredAt:  true,
        isPublished: true,
        upvotes:     true,
        createdAt:   true,
      },
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'asc' }],
    });

    return questions.map(({ isPublished, ...question }) => ({
      ...question,
      // Never leak a draft answer. The question itself remains visible as
      // unanswered until the shop explicitly publishes its reply.
      answer: isPublished ? question.answer : null,
      answeredAt: isPublished ? question.answeredAt : null,
    }));
  }

  // ── Customer: upvote ─────────────────────────────────────────────────────────

  async upvote(questionId: string): Promise<void> {
    const exists = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, isPublished: true, isSpam: false },
    });
    if (!exists) throw new NotFoundException('Question not found');

    await this.prisma.productQuestion.update({
      where: { id: questionId },
      data:  { upvotes: { increment: 1 } },
    });
  }

  // ── Admin: all questions for a product ──────────────────────────────────────

  async getAdminQuestions(productId: string, filter?: 'all' | 'unanswered') {
    return this.prisma.productQuestion.findMany({
      where: {
        productId,
        isSpam:    false,
        ...(filter === 'unanswered' ? { answer: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Admin: centralized question inbox ──────────────────────────────────────

  async getAdminQuestionInbox(
    query: AdminQuestionInboxQuery,
    storeId?: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const search = query.q?.trim();

    const baseWhere: Prisma.ProductQuestionWhereInput = {
      isSpam: false,
      ...(storeId ? { product: { storeId } } : {}),
      ...(search
        ? {
            OR: [
              { question: { contains: search, mode: 'insensitive' } },
              { askedByName: { contains: search, mode: 'insensitive' } },
              { askedByEmail: { contains: search, mode: 'insensitive' } },
              { product: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const where: Prisma.ProductQuestionWhereInput = {
      ...baseWhere,
      ...(query.filter === 'unanswered' ? { answer: null } : {}),
      ...(query.filter === 'answered' ? { answer: { not: null } } : {}),
    };

    // Return every tab count with the list response. Previously the UI knew
    // only the active tab's pagination total plus a separate unanswered count,
    // so at least one badge was always missing. The same baseWhere keeps all
    // three counts scoped to the current store and search term.
    const [questions, allCount, unansweredCount] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: {
                where: { isPrimary: true },
                select: { url: true },
                take: 1,
              },
              store: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.productQuestion.count({ where: baseWhere }),
      this.prisma.productQuestion.count({
        where: { ...baseWhere, answer: null },
      }),
    ]);

    const counts = {
      all: allCount,
      unanswered: unansweredCount,
      answered: allCount - unansweredCount,
    };
    const total = counts[query.filter ?? 'all'];

    return {
      ...paginatedResponse(
        questions.map(({ product, ...question }) => ({
          ...question,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            imageUrl: product.images[0]?.url ?? null,
            store: product.store,
          },
        })),
        page,
        limit,
        total,
      ),
      counts,
    };
  }

  // ── Admin: global unanswered count ──────────────────────────────────────────

  async getUnansweredCount(storeId?: string): Promise<number> {
    return this.prisma.productQuestion.count({
      where: {
        answer: null,
        isSpam: false,
        ...(storeId ? { product: { storeId } } : {}),
      },
    });
  }

  // ── Admin: answer ────────────────────────────────────────────────────────────

  async answerQuestion(
    productId: string,
    questionId: string,
    dto: AnswerQuestionDto,
    shopBaseUrl: string,
  ) {
    const existing = await this.findQuestionForProduct(productId, questionId);

    const productUrl = `${shopBaseUrl}/products/${existing.product.slug}`;

    const publish = dto.publish ?? true;
    const q = await this.prisma.productQuestion.update({
      where: { id: questionId },
      data:  {
        answer:      dto.answer.trim(),
        answeredAt:  new Date(),
        isPublished: publish,
      },
    });

    this.moderationService?.queueQAModeration(q.id).catch((e: Error) => this.logger.error('qa mod queue failed', e));

    if (q.askedByEmail && publish) {
      this.notifications.queueEmail({
        to:       q.askedByEmail,
        subject:  'Your question has been answered!',
        template: 'contact-message' as any, // reuse closest template until question-answered exists
        data: {
          askerName:  q.askedByName,
          question:   q.question,
          answer:     dto.answer.trim(),
          productUrl,
        },
      }).catch((err: Error) =>
        this.logger.warn(`Failed to send question-answered email: ${err.message}`),
      );
    }

    return q;
  }

  // ── Admin: patch (toggle publish / edit answer) ──────────────────────────────

  async patchQuestion(
    productId: string,
    questionId: string,
    data: { answer?: string; isPublished?: boolean },
  ) {
    await this.findQuestionForProduct(productId, questionId);
    return this.prisma.productQuestion.update({ where: { id: questionId }, data });
  }

  // ── Admin: moderation ────────────────────────────────────────────────────────

  async moderateQuestion(
    productId: string,
    questionId: string,
    action: 'spam' | 'delete',
  ): Promise<void> {
    await this.findQuestionForProduct(productId, questionId);

    if (action === 'delete') {
      await this.prisma.productQuestion.delete({ where: { id: questionId } });
    } else {
      await this.prisma.productQuestion.update({
        where: { id: questionId },
        data:  { isSpam: true, isPublished: false },
      });
    }
  }

  // ── FAQ structured data ──────────────────────────────────────────────────────

  static generateFaqStructuredData(
    qas: Array<{ question: string; answer: string | null }>,
  ): Record<string, unknown> | null {
    const answered = qas.filter((q) => q.answer);
    if (answered.length === 0) return null;
    return {
      '@context': 'https://schema.org',
      '@type':    'FAQPage',
      mainEntity: answered.map((qa) => ({
        '@type': 'Question',
        name:    qa.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text:    qa.answer,
        },
      })),
    };
  }

  private async findQuestionForProduct(
    productId: string,
    questionId: string,
  ) {
    const question = await this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      include: { product: { select: { slug: true } } },
    });
    if (!question || question.productId !== productId) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }
}
