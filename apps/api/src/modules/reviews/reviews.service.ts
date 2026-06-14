import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import {
  RedisService,
  CacheKeys,
  CacheTtl,
} from '../../common/services/redis.service';
import {
  PaginatedResult,
  paginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ReviewResponseDto,
  AdminReviewResponseDto,
  ReviewSummaryDto,
  ReviewAuthorDto,
} from './dto/review-response.dto';
import { ReviewQueryDto, AdminReviewQueryDto } from './dto/review-query.dto';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { OrderStatus, Review, ReviewStatus } from '@prisma/client';
import { CoinService } from '../coins/coin.service';

const REVIEW_INCLUDE = {
  user: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
} as const;

const ADMIN_REVIEW_INCLUDE = {
  user: {
    select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
      category: { select: { name: true } },
    },
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
    @Optional() private readonly moderationService?: ModerationService,
    @Optional() private readonly coinService?: CoinService,
  ) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  async getProductReviews(
    productSlug: string,
    query: ReviewQueryDto,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug },
      select: { id: true },
    });
    if (!product)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Product not found',
      });

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
    const product = await this.prisma.product.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!product)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Product not found',
      });
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
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<
      1 | 2 | 3 | 4 | 5,
      number
    >;

    let sum = 0;
    for (const r of reviews) {
      sum += r.rating;
      (distribution as Record<number, number>)[r.rating] =
        ((distribution as Record<number, number>)[r.rating] ?? 0) + 1;
    }

    const summary: ReviewSummaryDto = {
      productId,
      averageRating:
        totalReviews > 0 ? Math.round((sum / totalReviews) * 10) / 10 : 0,
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
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug },
      select: { id: true },
    });
    if (!product)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Product not found',
      });

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
        message:
          'You can only review products from delivered or completed orders',
      });
    }

    // Duplicate check: one review per user + product + order
    const existing = await this.prisma.review.findUnique({
      where: {
        userId_productId_orderId: {
          userId,
          productId: product.id,
          orderId: dto.orderId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'ERR_REVIEW_DUPLICATE',
        message: 'You have already reviewed this product for this order',
      });
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

    // fire-and-forget
    this.moderationService?.queueReviewModeration(review.id).catch((e) => this.logger.error('mod queue failed', e));
    if ((review.imageUrls as string[])?.length) {
      this.moderationService?.queueReviewImageModeration(review.id, review.imageUrls as string[], review.storeId ?? null)
        .catch((e) => this.logger.error('mod img queue failed', e));
    }
    this.coinService?.earnReviewCoins(userId, review.id, false).catch((e) => this.logger.error('coin review earn failed', e));

    return this.mapToDto(review);
  }

  async updateReview(
    userId: string,
    reviewId: string,
    dto: Partial<CreateReviewDto>,
  ): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Review not found',
      });
    if (review.userId !== userId)
      throw new ForbiddenException({ code: 'ERR_FORBIDDEN' });
    if (review.status !== ReviewStatus.PENDING) {
      throw new BadRequestException({
        code: 'ERR_REVIEW_LOCKED',
        message: 'Only pending reviews can be edited',
      });
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
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Review not found',
      });
    if (review.userId !== userId)
      throw new ForbiddenException({ code: 'ERR_FORBIDDEN' });

    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.redis.del(CacheKeys.reviewsSummary(review.productId));
  }

  async uploadReviewImages(
    userId: string,
    reviewId: string,
    files: Express.Multer.File[],
  ): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Review not found',
      });
    if (review.userId !== userId)
      throw new ForbiddenException({ code: 'ERR_FORBIDDEN' });

    const currentCount = review.imageUrls.length;
    if (currentCount + files.length > 5) {
      throw new BadRequestException({
        code: 'ERR_TOO_MANY_IMAGES',
        message: `Reviews can have at most 5 images. Currently has ${currentCount}.`,
      });
    }

    const uploadedUrls = await Promise.all(
      files.map((file) => {
        const key = this.storage.generateKey(
          `reviews/${reviewId}`,
          file.originalname,
        );
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

  async getMyReview(
    userId: string,
    productSlug: string,
  ): Promise<ReviewResponseDto | null> {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug },
      select: { id: true },
    });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    const review = await this.prisma.review.findFirst({
      where: { productId: product.id, userId },
      include: REVIEW_INCLUDE,
    });
    return review ? this.mapToDto(review) : null;
  }

  async markHelpful(reviewId: string): Promise<void> {
    await this.findReviewOrThrow(reviewId);
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
    });
  }

  async getReviewableProducts(userId: string): Promise<{
    orderId: string;
    orderNumber: string;
    productId: string;
    productName: string;
    productSlug: string;
    productImageUrl: string | null;
  }[]> {
    const deliveredOrders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      },
      select: {
        id: true,
        orderNumber: true,
        items: {
          select: {
            productId: true,
            productName: true,
            productSlug: true,
            productImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Filter out already-reviewed
    const reviewed = await this.prisma.review.findMany({
      where: { userId },
      select: { productId: true, orderId: true },
    });
    const reviewedKeys = new Set(
      reviewed.map((r) => `${r.productId}-${r.orderId}`),
    );

    return deliveredOrders.flatMap((order) =>
      order.items
        .filter(
          (item) =>
            item.productId &&
            !reviewedKeys.has(`${item.productId}-${order.id}`),
        )
        .map((item) => ({
          orderId:         order.id,
          orderNumber:     order.orderNumber,
          productId:       item.productId!,
          productName:     item.productName,
          productSlug:     item.productSlug ?? '',
          productImageUrl: item.productImageUrl,
        })),
    );
  }

  // ── Global public ────────────────────────────────────────────────────────────

  async getGlobalReviews(
    query: ReviewQueryDto,
  ): Promise<PaginatedResult<ReviewResponseDto & { product: { name: string; slug: string; primaryImage: string | null } }>> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 12;
    const where = { status: ReviewStatus.APPROVED };

    const include = {
      ...REVIEW_INCLUDE,
      product: { select: { name: true, slug: true, images: { select: { url: true }, take: 1, orderBy: { sortOrder: 'asc' as const } } } },
    };

    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    const items = rows.map((r) => ({
      ...this.mapToDto(r),
      product: {
        name:         r.product.name,
        slug:         r.product.slug,
        primaryImage: r.product.images[0]?.url ?? null,
      },
    }));

    return paginatedResponse(items, page, limit, total);
  }

  async getGlobalSummary(): Promise<Omit<ReviewSummaryDto, 'productId'>> {
    const reviews = await this.prisma.review.findMany({
      where:  { status: ReviewStatus.APPROVED },
      select: { rating: true },
    });

    const totalReviews  = reviews.length;
    const distribution  = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
    let sum = 0;
    for (const r of reviews) {
      sum += r.rating;
      (distribution as Record<number, number>)[r.rating] =
        ((distribution as Record<number, number>)[r.rating] ?? 0) + 1;
    }

    return {
      averageRating: totalReviews > 0 ? Math.round((sum / totalReviews) * 10) / 10 : 0,
      totalReviews,
      distribution,
    };
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  async findAllAdmin(query: AdminReviewQueryDto): Promise<PaginatedResult<AdminReviewResponseDto>> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 24;

    const where: Record<string, unknown> = {};
    if (query.status    !== undefined) where['status']    = query.status;
    if (query.rating    !== undefined) where['rating']    = query.rating;
    if (query.productId !== undefined) where['productId'] = query.productId;
    if (query.q) {
      where['OR'] = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { body:  { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: ADMIN_REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    const data = reviews.map((r) => {
      const u = r.user as { id: string; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null };
      const p = (r as any).product as { id: string; name: string; slug: string; images: { url: string }[]; category: { name: string } | null } | null;
      return {
        id:               r.id,
        userId:           r.userId,
        orderId:          r.orderId,
        productId:        r.productId,
        rating:           r.rating,
        title:            r.title,
        body:             r.body,
        imageUrls:        r.imageUrls,
        status:           r.status,
        adminReply:       r.adminReply,
        repliedAt:        r.repliedAt,
        createdAt:        r.createdAt,
        customerName:     `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
        customerEmail:    u.email,
        customerAvatarUrl: u.avatarUrl,
        productName:      p?.name   ?? '',
        productSlug:      p?.slug   ?? '',
        productImageUrl:  p?.images[0]?.url ?? null,
        categoryName:     p?.category?.name ?? null,
      };
    });

    return paginatedResponse(data, page, limit, total);
  }

  async getAdminCounts(): Promise<Record<string, number>> {
    const statuses = ['PENDING', 'APPROVED', 'HIDDEN'];
    const counts = await Promise.all(
      statuses.map((status) => this.prisma.review.count({ where: { status: status as ReviewStatus } })),
    );
    const total = counts.reduce((sum, n) => sum + n, 0);
    return {
      PENDING:  counts[0],
      APPROVED: counts[1],
      HIDDEN:   counts[2],
      ALL:      total,
    };
  }

  async adminDeleteReview(reviewId: string): Promise<void> {
    const review = await this.findReviewOrThrow(reviewId);
    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.redis.del(CacheKeys.reviewsSummary(review.productId));
  }

  async approveReview(reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.findReviewOrThrow(reviewId);
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.APPROVED },
      include: REVIEW_INCLUDE,
    });
    await this.redis.del(CacheKeys.reviewsSummary(review.productId));

    // Denormalize store rating when review is approved
    if (review.storeId) {
      await this.recalcStoreRating(review.storeId);
    }

    return this.mapToDto(updated);
  }

  private async recalcStoreRating(storeId: string): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where:   { storeId, status: ReviewStatus.APPROVED },
      _avg:    { rating: true },
      _count:  { rating: true },
    });
    const avg = agg._avg.rating ?? 0;
    await this.prisma.store.update({
      where: { id: storeId },
      data:  { rating: Math.round(avg * 100) / 100 },
    });
  }

  async listReviewsForStore(
    storeId: string,
    params: { page?: number; limit?: number; status?: string },
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const page  = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip  = (page - 1) * limit;
    const where = {
      storeId,
      ...(params.status ? { status: params.status as ReviewStatus } : {}),
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return paginatedResponse(reviews.map(this.mapToDto.bind(this)), page, limit, total);
  }

  async replyToReviewAsSeller(
    reviewId: string,
    storeId: string,
    reply: string,
  ): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, storeId },
    });
    if (!review) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Review not found' });

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data:  { sellerReply: reply, sellerRepliedAt: new Date() },
      include: REVIEW_INCLUDE,
    });
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

  async replyToReview(
    reviewId: string,
    reply: string,
  ): Promise<ReviewResponseDto> {
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
            productName:
              order.items[0]?.product?.name ?? 'your recent purchase',
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
    if (!review)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Review not found',
      });
    return review;
  }

  private mapToDto = (
    review: Review & {
      user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
      };
    },
  ): ReviewResponseDto => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    imageUrls: review.imageUrls,
    status: review.status,
    adminReply:      review.adminReply,
    repliedAt:       review.repliedAt,
    sellerReply:     (review as any).sellerReply ?? null,
    sellerRepliedAt: (review as any).sellerRepliedAt ?? null,
    createdAt:       review.createdAt,
    author: {
      id: review.user.id,
      firstName: review.user.firstName,
      lastName: review.user.lastName,
      avatarUrl: review.user.avatarUrl,
    },
  });
}
