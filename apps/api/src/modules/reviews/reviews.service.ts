import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { RedisService, CacheKeys, CacheTtl } from '../../common/services/redis.service';
import { PaginatedResult, paginatedResponse } from '../../common/dto/paginated-response.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ReviewResponseDto,
  ReviewSummaryDto,
  ReviewAuthorDto,
} from './dto/review-response.dto';
import { ReviewQueryDto, AdminReviewQueryDto } from './dto/review-query.dto';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { OrderStatus, Review, ReviewStatus } from '@prisma/client';

const REVIEW_INCLUDE = {
  user: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
} as const;

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  async getProductReviews(
    productSlug: string,
    query: ReviewQueryDto,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const product = await this.prisma.product.findUnique({
      where: { slug: productSlug },
      select: { id: true },
    });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where = {
      productId: product.id,
      status: query.status ?? ReviewStatus.APPROVED,
      ...(query.rating !== undefined && { rating: query.rating }),
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return paginatedResponse(reviews.map(this.mapToDto), page, limit, total);
  }

  async getProductSummaryBySlug(slug: string): Promise<ReviewSummaryDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    return this.getReviewSummary(product.id);
  }

  async getReviewSummary(productId: string): Promise<ReviewSummaryDto> {
    const cacheKey = CacheKeys.reviewsSummary(productId);
    const cached = await this.redis.get<ReviewSummaryDto>(cacheKey);
    if (cached) return cached;

    const reviews = await this.prisma.review.findMany({
      where: { productId, status: ReviewStatus.APPROVED },
      select: { rating: true },
    });

    const totalReviews = reviews.length;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;

    let sum = 0;
    for (const r of reviews) {
      sum += r.rating;
      (distribution as Record<number, number>)[r.rating] = ((distribution as Record<number, number>)[r.rating] ?? 0) + 1;
    }

    const summary: ReviewSummaryDto = {
      productId,
      averageRating: totalReviews > 0 ? Math.round((sum / totalReviews) * 10) / 10 : 0,
      totalReviews,
      distribution,
    };

    await this.redis.set(cacheKey, summary, CacheTtl.medium);
    return summary;
  }

  async createReview(
    userId: string,
    productSlug: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug: productSlug },
      select: { id: true },
    });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    // Buyer guard: user must have a DELIVERED or COMPLETED order containing this product
    const qualifyingOrder = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        userId,
        status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        items: { some: { productId: product.id } },
      },
      select: { id: true },
    });

    if (!qualifyingOrder) {
      throw new ForbiddenException({
        code: 'ERR_REVIEW_NOT_ELIGIBLE',
        message: 'You can only review products from delivered or completed orders',
      });
    }

    // Duplicate check: one review per user + product + order
    const existing = await this.prisma.review.findUnique({
      where: { userId_productId_orderId: { userId, productId: product.id, orderId: dto.orderId } },
    });
    if (existing) {
      throw new BadRequestException({ code: 'ERR_REVIEW_DUPLICATE', message: 'You have already reviewed this product for this order' });
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: product.id,
        orderId: dto.orderId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        status: ReviewStatus.PENDING,
        imageUrls: [],
      },
      include: REVIEW_INCLUDE,
    });

    return this.mapToDto(review);
  }

  async updateReview(
    userId: string,
    reviewId: string,
    dto: Partial<CreateReviewDto>,
  ): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Review not found' });
    if (review.userId !== userId) throw new ForbiddenException({ code: 'ERR_FORBIDDEN' });
    if (review.status !== ReviewStatus.PENDING) {
      throw new BadRequestException({ code: 'ERR_REVIEW_LOCKED', message: 'Only pending reviews can be edited' });
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.body !== undefined && { body: dto.body }),
      },
      include: REVIEW_INCLUDE,
    });

    return this.mapToDto(updated);
  }

  async deleteReview(userId: string, reviewId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Review not found' });
    if (review.userId !== userId) throw new ForbiddenException({ code: 'ERR_FORBIDDEN' });

    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.redis.del(CacheKeys.reviewsSummary(review.productId));
  }

  async uploadReviewImages(
    userId: string,
    reviewId: string,
    files: Express.Multer.File[],
  ): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Review not found' });
    if (review.userId !== userId) throw new ForbiddenException({ code: 'ERR_FORBIDDEN' });

    const currentCount = review.imageUrls.length;
    if (currentCount + files.length > 5) {
      throw new BadRequestException({
        code: 'ERR_TOO_MANY_IMAGES',
        message: `Reviews can have at most 5 images. Currently has ${currentCount}.`,
      });
    }

    const uploadedUrls = await Promise.all(
      files.map((file) => {
        const key = this.storage.generateKey(`reviews/${reviewId}`, file.originalname);
        return this.storage.uploadFile(file.buffer, key, file.mimetype);
      }),
    );

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { imageUrls: [...review.imageUrls, ...uploadedUrls] },
      include: REVIEW_INCLUDE,
    });

    return this.mapToDto(updated);
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  async findAllAdmin(
    query: AdminReviewQueryDto,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where = {
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return paginatedResponse(reviews.map(this.mapToDto), page, limit, total);
  }

  async approveReview(reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.findReviewOrThrow(reviewId);
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.APPROVED },
      include: REVIEW_INCLUDE,
    });
    await this.redis.del(CacheKeys.reviewsSummary(review.productId));
    return this.mapToDto(updated);
  }

  async hideReview(reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.findReviewOrThrow(reviewId);
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.HIDDEN },
      include: REVIEW_INCLUDE,
    });
    await this.redis.del(CacheKeys.reviewsSummary(review.productId));
    return this.mapToDto(updated);
  }

  async replyToReview(reviewId: string, reply: string): Promise<ReviewResponseDto> {
    await this.findReviewOrThrow(reviewId);
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { adminReply: reply, repliedAt: new Date() },
      include: REVIEW_INCLUDE,
    });
    return this.mapToDto(updated);
  }

  async sendReviewReminders(): Promise<void> {
    this.logger.log('Queuing review reminder emails');
    // Find DELIVERED orders from 3 days ago that haven't been reviewed
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000);
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1_000);

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        deliveredAt: { gte: fourDaysAgo, lte: threeDaysAgo },
        userId: { not: null },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
          take: 1,
        },
      },
    });

    let queued = 0;
    for (const order of orders) {
      if (!order.user?.email) continue;
      // Skip if already reviewed
      const reviewCount = await this.prisma.review.count({
        where: { userId: order.userId!, orderId: order.id },
      });
      if (reviewCount > 0) continue;

      await this.emailQueue.add(
        JOBS.SEND_EMAIL,
        {
          to: order.user.email,
          template: 'review-reminder',
          subject: 'How was your order? Leave a review!',
          data: {
            firstName: order.user.firstName ?? 'Valued Customer',
            orderNumber: order.orderNumber,
            orderId: order.id,
            productName: order.items[0]?.product?.name ?? 'your recent purchase',
            productSlug: order.items[0]?.product?.slug ?? '',
          },
        },
        DEFAULT_JOB_OPTIONS,
      );
      queued++;
    }

    this.logger.log(`Review reminders queued: ${queued}`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async findReviewOrThrow(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Review not found' });
    return review;
  }

  private mapToDto = (
    review: Review & { user: { id: string; firstName: string | null; lastName: string | null; avatarUrl: string | null } },
  ): ReviewResponseDto => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    imageUrls: review.imageUrls,
    status: review.status,
    adminReply: review.adminReply,
    repliedAt: review.repliedAt,
    createdAt: review.createdAt,
    author: {
      id: review.user.id,
      firstName: review.user.firstName,
      lastName: review.user.lastName,
      avatarUrl: review.user.avatarUrl,
    },
  });
}
