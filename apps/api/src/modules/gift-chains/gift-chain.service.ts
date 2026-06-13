import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { GiftChainStatus } from '@prisma/client';

@Injectable()
export class GiftChainService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.GIFT_CHAINS) private readonly giftChainsQueue: Queue,
  ) {}

  async initiateChain(initiatorId: string, dto: { productId: string; recipientEmail: string }) {
    const chain = await this.prisma.giftChain.create({
      data: {
        initiatorId,
        initialProductId: dto.productId,
        status: GiftChainStatus.ACTIVE,
        totalLinks: 1,
        isPublic: true,
      },
    });
    // Create first link — initiator sends to recipient
    const link = await this.prisma.giftChainLink.create({
      data: {
        chainId:       chain.id,
        senderId:      initiatorId,
        recipientEmail: dto.recipientEmail,
        productId:     dto.productId,
        linkPosition:  1,
        discountApplied: false,
        continuedChain:  false,
      },
    });
    // Schedule nudge email in 3 days if recipient hasn't forwarded
    await this.giftChainsQueue.add(
      JOBS.GIFT_CHAIN_NUDGE,
      { chainId: chain.id, linkId: link.id },
      { delay: 3 * 24 * 60 * 60 * 1000 },
    );
    return chain;
  }

  async getChain(chainId: string) {
    const chain = await this.prisma.giftChain.findUnique({
      where: { id: chainId },
      include: {
        links: { orderBy: { linkPosition: 'asc' } },
        product: { select: { id: true, name: true, slug: true, images: { take: 1 } } },
      },
    });
    if (!chain) throw new NotFoundException('Gift chain not found');
    return chain;
  }

  async forwardChain(chainId: string, forwarderId: string, recipientEmail: string, productId: string): Promise<void> {
    const chain = await this.prisma.giftChain.findUnique({
      where: { id: chainId },
      include: { links: true },
    });
    if (!chain) throw new NotFoundException();
    if (chain.status !== GiftChainStatus.ACTIVE) throw new BadRequestException('Chain is no longer active');
    if (chain.links.length >= 10) throw new BadRequestException('Chain has reached maximum length');

    const nextPosition = chain.totalLinks + 1;

    await this.prisma.$transaction([
      this.prisma.giftChainLink.create({
        data: {
          chainId,
          senderId:        forwarderId,
          recipientEmail,
          productId:       productId ?? chain.initialProductId,
          linkPosition:    nextPosition,
          discountApplied: false,
          continuedChain:  true,
        },
      }),
      this.prisma.giftChain.update({
        where: { id: chainId },
        data: { totalLinks: nextPosition, lastActivityAt: new Date() },
      }),
      // Record reward for forwarder — 10 coins
      this.prisma.giftChainReward.create({
        data: { chainId, userId: forwarderId, role: 'forwarder', coinsEarned: 10 },
      }),
    ]);
  }

  async closeInactiveChains(): Promise<void> {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await this.prisma.giftChain.updateMany({
      where: { status: GiftChainStatus.ACTIVE, lastActivityAt: { lt: cutoff } },
      data: { status: GiftChainStatus.CLOSED, closedAt: new Date() },
    });
  }

  async getMyChains(userId: string) {
    return this.prisma.giftChain.findMany({
      where: { initiatorId: userId },
      include: { product: { select: { name: true, images: { take: 1 } } } },
      orderBy: { startedAt: 'desc' },
    });
  }
}
