import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { BlindMatchStatus } from '@prisma/client';

@Injectable()
export class BlindMatchService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.BLIND_MATCH) private readonly blindMatchQueue: Queue,
  ) {}

  async requestMatch(buyerId: string, dto: {
    recipientName: string;
    recipientEmail: string;
    shippingAddress: Record<string, unknown>;
    niche: string[];
    personality: string;
    budgetMin: number;
    budgetMax: number;
    occasion: string;
    giftMessage?: string;
  }) {
    const request = await this.prisma.blindMatchRequest.create({
      data: {
        buyerId,
        recipientName:   dto.recipientName,
        recipientEmail:  dto.recipientEmail,
        shippingAddress: dto.shippingAddress as any,
        niche:           dto.niche,
        personality:     dto.personality,
        budgetMin:       dto.budgetMin,
        budgetMax:       dto.budgetMax,
        occasion:        dto.occasion,
        giftMessage:     dto.giftMessage,
        status:          BlindMatchStatus.PENDING,
        buyerRevealed:   false,
      },
    });
    await this.blindMatchQueue.add(JOBS.BLIND_MATCH_PROCESS, { requestId: request.id });
    return request;
  }

  async processMatch(requestId: string): Promise<void> {
    const request = await this.prisma.blindMatchRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== BlindMatchStatus.PENDING) return;

    const product = await this.prisma.product.findFirst({
      where: { status: 'ACTIVE', basePrice: { lte: Number(request.budgetMax) } },
      orderBy: { createdAt: 'desc' },
    });
    if (!product) return;

    await this.prisma.$transaction([
      this.prisma.blindMatchRequest.update({
        where: { id: requestId },
        data:  { status: BlindMatchStatus.MATCHED, selectedProductId: product.id },
      }),
      this.prisma.blindMatchAuditLog.create({
        data: {
          requestId,
          aiModelVersion:   'rule-based-v1',
          candidateProducts: [],
          selectedProductId: product.id,
          selectionReason:   `Rule-based: basePrice <= ${request.budgetMax}, status ACTIVE`,
        },
      }),
    ]);
  }

  async getMystery(requestId: string, buyerId: string) {
    const request = await this.prisma.blindMatchRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException();
    if (request.buyerId !== buyerId) throw new BadRequestException('Access denied');

    const isRevealed = request.buyerRevealed ||
      request.status === BlindMatchStatus.REVEALED ||
      request.status === BlindMatchStatus.DELIVERED;

    const product = isRevealed && request.selectedProductId
      ? await this.prisma.product.findUnique({
          where:  { id: request.selectedProductId },
          select: { name: true, slug: true, images: { take: 1 }, basePrice: true },
        })
      : null;

    return {
      requestId:    request.id,
      status:       request.status,
      budgetRange:  { min: Number(request.budgetMin), max: Number(request.budgetMax) },
      buyerRevealed: request.buyerRevealed,
      product,
    };
  }

  async revealProduct(requestId: string, buyerId: string) {
    const request = await this.prisma.blindMatchRequest.findUnique({ where: { id: requestId } });
    if (!request || request.buyerId !== buyerId) throw new NotFoundException();
    if (request.status !== BlindMatchStatus.MATCHED) throw new BadRequestException('Product not yet matched');

    await this.prisma.blindMatchRequest.update({
      where: { id: requestId },
      data:  { status: BlindMatchStatus.REVEALED, buyerRevealed: true },
    });
    return this.getMystery(requestId, buyerId);
  }

  async rateMatch(requestId: string, buyerId: string, score: number, note?: string) {
    const request = await this.prisma.blindMatchRequest.findUnique({ where: { id: requestId } });
    if (!request || request.buyerId !== buyerId) throw new NotFoundException();
    if (request.status !== BlindMatchStatus.REVEALED) throw new BadRequestException('Product not yet revealed');

    await this.prisma.blindMatchRating.create({
      data: {
        requestId,
        recipientId:     buyerId,
        rating:          score,
        feedbackText:    note,
        buyerRefundIssued: score <= 2,
      },
    });

    if (score <= 2) {
      await this.blindMatchQueue.add(JOBS.BLIND_MATCH_CREDIT, { requestId, userId: buyerId, amount: 5 });
    }

    return { rated: true, creditIssued: score <= 2 };
  }

  async getHistory(buyerId: string) {
    return this.prisma.blindMatchRequest.findMany({
      where:   { buyerId },
      orderBy: { createdAt: 'desc' },
      include: { ratings: { select: { rating: true, feedbackText: true, ratedAt: true } } },
    });
  }

  async getHallOfFame(limit = 10) {
    const ratings = await this.prisma.blindMatchRating.findMany({
      where:   { rating: { gte: 4 } },
      orderBy: { rating: 'desc' },
      take:    Math.min(limit, 50),
      select: {
        rating:      true,
        feedbackText: true,
        ratedAt:     true,
        request: {
          select: {
            recipientName: true,
            occasion:      true,
            selectedProductId: true,
          },
        },
      },
    });
    return ratings.map((r) => ({
      rating:       r.rating,
      feedback:     r.feedbackText,
      ratedAt:      r.ratedAt,
      recipientName: r.request.recipientName,
      occasion:     r.request.occasion,
    }));
  }

  async getUgc(limit = 12) {
    const ratings = await this.prisma.blindMatchRating.findMany({
      where:   { rating: { gte: 4 }, feedbackText: { not: null } },
      orderBy: { ratedAt: 'desc' },
      take:    Math.min(limit, 50),
      select: {
        rating:      true,
        feedbackText: true,
        ratedAt:     true,
        request: {
          select: {
            recipientName: true,
            occasion:      true,
          },
        },
      },
    });
    return ratings.map((r) => ({
      rating:       r.rating,
      feedback:     r.feedbackText,
      ratedAt:      r.ratedAt,
      recipientName: r.request.recipientName,
      occasion:     r.request.occasion,
    }));
  }
}
