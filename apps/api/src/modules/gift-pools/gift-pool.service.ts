import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { GiftPoolStatus } from '@prisma/client';

const generateToken = () => randomBytes(8).toString('hex'); // 16 chars hex

export interface CreatePoolDto {
  productId: string;
  recipientName: string;
  shippingAddress: object;
  targetAmount: number;
  deadline: Date;
  giftMessage?: string;
}

export interface ContributeDto {
  amount: number;
  contributorId?: string;
  stripePaymentId: string;
  isAnonymous?: boolean;
}

@Injectable()
export class GiftPoolService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.GIFT_POOLS) private readonly giftPoolQueue: Queue,
  ) {}

  async createPool(organizerId: string, dto: CreatePoolDto) {
    const shareToken = generateToken();
    return this.prisma.giftPool.create({
      data: {
        shareToken,
        organizerId,
        productId: dto.productId,
        recipientName: dto.recipientName,
        shippingAddress: dto.shippingAddress,
        targetAmount: dto.targetAmount,
        collectedAmount: 0,
        status: GiftPoolStatus.ACTIVE,
        deadline: dto.deadline,
        giftMessage: dto.giftMessage,
      },
    });
  }

  async getPool(shareToken: string) {
    const pool = await this.prisma.giftPool.findUnique({
      where: { shareToken },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            images: { take: 1 },
          },
        },
        contributions: {
          select: {
            id: true,
            amount: true,
            isAnonymous: true,
            contributedAt: true,
          },
          orderBy: { contributedAt: 'desc' },
        },
      },
    });
    if (!pool) throw new NotFoundException('Gift pool not found');
    return pool;
  }

  async contribute(shareToken: string, dto: ContributeDto) {
    const pool = await this.prisma.giftPool.findUnique({ where: { shareToken } });
    if (!pool) throw new NotFoundException('Gift pool not found');
    if (pool.status !== GiftPoolStatus.ACTIVE) {
      throw new BadRequestException('Gift pool is not active');
    }
    if (pool.deadline < new Date()) {
      throw new BadRequestException('Gift pool has expired');
    }

    const contribution = await this.prisma.$transaction(async (tx) => {
      const c = await tx.giftContribution.create({
        data: {
          giftPoolId: pool.id,
          contributorId: dto.contributorId ?? null,
          amount: dto.amount,
          stripePaymentId: dto.stripePaymentId,
          isAnonymous: dto.isAnonymous ?? false,
        },
      });
      await tx.giftPool.update({
        where: { id: pool.id },
        data: { collectedAmount: { increment: dto.amount } },
      });
      return c;
    });

    // Check if target reached → trigger auto-complete job
    const updatedPool = await this.prisma.giftPool.findUnique({ where: { id: pool.id } });
    if (updatedPool && updatedPool.collectedAmount >= updatedPool.targetAmount) {
      await this.giftPoolQueue.add(JOBS.GIFT_POOL_COMPLETE, { poolId: pool.id });
    }

    return contribution;
  }

  async completePool(poolId: string): Promise<void> {
    await this.prisma.giftPool.update({
      where: { id: poolId },
      data: { status: GiftPoolStatus.COMPLETED },
    });
    // In production: trigger order creation for the organizer
  }

  async expirePools(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.giftPool.findMany({
      where: { status: GiftPoolStatus.ACTIVE, deadline: { lt: now } },
    });
    for (const pool of expired) {
      await this.prisma.giftPool.update({
        where: { id: pool.id },
        data: { status: GiftPoolStatus.EXPIRED },
      });
      // In production: trigger refunds for all contributions
    }
  }

  async getMyPools(userId: string) {
    return this.prisma.giftPool.findMany({
      where: { organizerId: userId },
      include: {
        product: {
          select: { name: true, slug: true, images: { take: 1 } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
