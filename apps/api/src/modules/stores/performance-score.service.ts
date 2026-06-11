import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface ScoreResult {
  total:     number;
  shipping:  number;
  refund:    number;
  review:    number;
  response:  number;
  badge:     string | null;
  hasEnoughData: boolean;
}

const WINDOW_DAYS = 90;

@Injectable()
export class PerformanceScoreService {
  private readonly logger = new Logger(PerformanceScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateScore(storeId: string): Promise<ScoreResult> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // 1. Fetch data
    const [storeOrders, reviews, conversations] = await Promise.all([
      this.prisma.storeOrder.findMany({
        where:  { storeId, createdAt: { gte: since } },
        select: {
          status: true, createdAt: true, shippedAt: true,
          order: { select: { confirmedAt: true } },
        },
      }),
      this.prisma.review.findMany({
        where:  { storeId, status: 'APPROVED', createdAt: { gte: since } },
        select: { rating: true },
      }),
      this.prisma.conversation.findMany({
        where:   { storeId, createdAt: { gte: since } },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 10 } },
      }),
    ]);

    const totalOrders = storeOrders.length;
    const hasEnoughData = totalOrders >= 5 || reviews.length >= 3;

    if (!hasEnoughData) {
      await this.prisma.store.update({
        where: { id: storeId },
        data:  {
          performanceScore: null, scoreShipping: null,
          scoreRefund: null, scoreReview: null, scoreResponse: null,
          scoreBadge: null, scoreLastCalculatedAt: new Date(),
        },
      });
      return { total: 0, shipping: 0, refund: 0, review: 0, response: 0, badge: null, hasEnoughData: false };
    }

    // 2. Shipping accuracy (% shipped on time)
    const shippedOrders = storeOrders.filter(o => o.shippedAt);
    const onTimeShipped = shippedOrders.filter(o => {
      if (!o.shippedAt || !o.order.confirmedAt) return false;
      const processingDays = Math.ceil(
        (o.shippedAt.getTime() - o.order.confirmedAt.getTime()) / (24 * 60 * 60 * 1000),
      );
      return processingDays <= 7; // default: 7 days processing
    }).length;
    const shipScore = shippedOrders.length > 0
      ? Math.round((onTimeShipped / shippedOrders.length) * 100) : 80;

    // 3. Refund rate
    const refundedOrders = storeOrders.filter(o =>
      ['REFUNDED', 'REFUND_REQUESTED'].includes(o.status),
    ).length;
    const refundRate = totalOrders > 0 ? refundedOrders / totalOrders : 0;
    const refundScore = Math.round((1 - refundRate) * 100);

    // 4. Review rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 4;
    const reviewScore = Math.round(((avgRating - 1) / 4) * 100);

    // 5. Response time (avg hours to first reply)
    const responseTimes: number[] = [];
    for (const conv of conversations) {
      const messages = conv.messages;
      const firstCustomer = messages.find(m => m.senderType === 'CUSTOMER');
      const firstReply    = messages.find(
        m => m.senderType === 'SHOP' && m.createdAt > (firstCustomer?.createdAt ?? new Date(0)),
      );
      if (firstCustomer && firstReply) {
        const hours = (firstReply.createdAt.getTime() - firstCustomer.createdAt.getTime()) / (60 * 60 * 1000);
        responseTimes.push(hours);
      }
    }
    const avgResponseHours = responseTimes.length > 0
      ? responseTimes.reduce((s, h) => s + h, 0) / responseTimes.length : 24;
    const responseScore = Math.max(0, Math.round(100 - avgResponseHours * 2));

    // 6. Weighted total
    const total = Math.round(
      shipScore   * 0.30 +
      refundScore * 0.25 +
      reviewScore * 0.25 +
      responseScore * 0.20,
    );

    const badge = total >= 80 ? 'top_seller' : total >= 60 ? 'trusted' : null;

    await this.prisma.store.update({
      where: { id: storeId },
      data:  {
        performanceScore:      total,
        scoreShipping:         shipScore,
        scoreRefund:           refundScore,
        scoreReview:           reviewScore,
        scoreResponse:         responseScore,
        scoreBadge:            badge,
        scoreLastCalculatedAt: new Date(),
      },
    });

    return { total, shipping: shipScore, refund: refundScore, review: reviewScore, response: responseScore, badge, hasEnoughData: true };
  }

  async recalculateAllStores(): Promise<void> {
    const stores = await this.prisma.store.findMany({
      where:  { status: 'ACTIVE' },
      select: { id: true },
    });
    this.logger.log(`Recalculating scores for ${stores.length} active stores`);
    for (const store of stores) {
      await this.calculateScore(store.id).catch(err =>
        this.logger.error(`Score calc failed for store ${store.id}`, err),
      );
    }
  }

  async getScoreBreakdown(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where:  { id: storeId },
      select: {
        performanceScore: true, scoreShipping: true, scoreRefund: true,
        scoreReview: true, scoreResponse: true, scoreBadge: true, scoreLastCalculatedAt: true,
      },
    });
    return store;
  }
}
