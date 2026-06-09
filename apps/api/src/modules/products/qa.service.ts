import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

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

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Customer: ask a question ─────────────────────────────────────────────────

  async askQuestion(productSlug: string, dto: AskQuestionDto) {
    const product = await this.prisma.product.findUnique({
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
    return { id: q.id, message: "Question submitted! We'll answer it soon." };
  }

  // ── Public: get published Q&As ───────────────────────────────────────────────

  async getPublishedQAs(productSlug: string) {
    const product = await this.prisma.product.findUnique({
      where:  { slug: productSlug },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.productQuestion.findMany({
      where: { productId: product.id, isPublished: true, isSpam: false },
      select: {
        id:          true,
        question:    true,
        askedByName: true,
        answer:      true,
        answeredAt:  true,
        upvotes:     true,
        createdAt:   true,
      },
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'asc' }],
    });
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

  // ── Admin: global unanswered count ──────────────────────────────────────────

  async getUnansweredCount(): Promise<number> {
    return this.prisma.productQuestion.count({
      where: { answer: null, isSpam: false },
    });
  }

  // ── Admin: answer ────────────────────────────────────────────────────────────

  async answerQuestion(questionId: string, dto: AnswerQuestionDto, shopBaseUrl: string) {
    const existing = await this.prisma.productQuestion.findUnique({
      where:  { id: questionId },
      include: { product: { select: { slug: true } } },
    });
    if (!existing) throw new NotFoundException('Question not found');

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

  async patchQuestion(questionId: string, data: { answer?: string; isPublished?: boolean }) {
    const exists = await this.prisma.productQuestion.findUnique({ where: { id: questionId } });
    if (!exists) throw new NotFoundException('Question not found');
    return this.prisma.productQuestion.update({ where: { id: questionId }, data });
  }

  // ── Admin: moderation ────────────────────────────────────────────────────────

  async moderateQuestion(questionId: string, action: 'spam' | 'delete'): Promise<void> {
    const exists = await this.prisma.productQuestion.findUnique({ where: { id: questionId } });
    if (!exists) throw new NotFoundException('Question not found');

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
}
