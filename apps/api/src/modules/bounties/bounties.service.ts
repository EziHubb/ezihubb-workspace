import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';

@Injectable()
export class BountiesService {
  private readonly logger = new Logger(BountiesService.name);
  private readonly stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as const });
  }

  // ── Public: browse bounties ───────────────────────────────────────────────

  async listBounties(query: { page?: number; limit?: number; status?: string }) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {};
    if (query.status) where.status = query.status;
    else where.status = 'OPEN';

    const [items, total] = await Promise.all([
      this.prisma.designBounty.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, brief: true, budget: true, deadline: true,
          status: true, entryCount: true, createdAt: true,
          poster: { select: { firstName: true } },
        },
      }),
      this.prisma.designBounty.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getBounty(id: string) {
    return this.prisma.designBounty.findUnique({
      where:   { id },
      include: { poster: { select: { firstName: true } } },
    });
  }

  // ── Create bounty (with Stripe escrow) ───────────────────────────────────

  async createBounty(posterId: string, dto: {
    title: string; brief: string; budget: number;
    deadline: string; maxSubmissions?: number; posterStoreId?: string;
  }): Promise<{ bountyId: string; clientSecret: string }> {
    if (dto.budget < 15) throw new BadRequestException('Minimum budget is $15');

    const platformFee  = Math.round(dto.budget * 0.20 * 100) / 100;
    const winnerPayout = Math.round((dto.budget - platformFee) * 100) / 100;

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount:         Math.round(dto.budget * 100),
      currency:       'usd',
      capture_method: 'manual', // escrow: capture manually when winner selected
      metadata:       { type: 'design_bounty', posterId },
    });

    const bounty = await this.prisma.designBounty.create({
      data: {
        posterId,
        posterStoreId:         dto.posterStoreId ?? null,
        title:                 dto.title,
        brief:                 dto.brief,
        budget:                dto.budget,
        platformFee,
        winnerPayout,
        deadline:              new Date(dto.deadline),
        maxSubmissions:        dto.maxSubmissions ?? null,
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    return { bountyId: bounty.id, clientSecret: paymentIntent.client_secret! };
  }

  // ── Submit entry ──────────────────────────────────────────────────────────

  async submitEntry(designerId: string, bountyId: string, dto: {
    previewImageUrl: string; fullResImageUrl: string; description?: string;
  }) {
    const bounty = await this.prisma.designBounty.findUnique({ where: { id: bountyId } });
    if (!bounty) throw new NotFoundException('Bounty not found');
    if (bounty.status !== 'OPEN') throw new BadRequestException('Bounty is not open');
    if (bounty.posterId === designerId) throw new BadRequestException('Cannot enter your own bounty');
    if (bounty.maxSubmissions && bounty.entryCount >= bounty.maxSubmissions) {
      throw new BadRequestException('Maximum submissions reached');
    }

    const entry = await this.prisma.designBountyEntry.create({
      data: { bountyId, designerId, ...dto },
    });

    await this.prisma.designBounty.update({
      where: { id: bountyId },
      data:  { entryCount: { increment: 1 } },
    });

    return entry;
  }

  // ── Select winner ─────────────────────────────────────────────────────────

  async selectWinner(posterId: string, bountyId: string, entryId: string) {
    const bounty = await this.prisma.designBounty.findFirst({
      where: { id: bountyId, posterId },
    });
    if (!bounty) throw new NotFoundException('Bounty not found');
    if (bounty.status !== 'OPEN' && bounty.status !== 'SELECTING') {
      throw new BadRequestException('Bounty is not in a selectable state');
    }

    const entry = await this.prisma.designBountyEntry.findFirst({
      where:   { id: entryId, bountyId },
      include: { designer: { select: { email: true, firstName: true } } },
    });
    if (!entry) throw new NotFoundException('Entry not found');

    // Capture Stripe payment
    if (bounty.stripePaymentIntentId) {
      await this.stripe.paymentIntents.capture(bounty.stripePaymentIntentId).catch(() => {});
    }

    await this.prisma.$transaction([
      this.prisma.designBounty.update({
        where: { id: bountyId },
        data:  { status: 'COMPLETED', winnerId: entryId },
      }),
      this.prisma.designBountyEntry.update({
        where: { id: entryId },
        data:  { status: 'SELECTED' },
      }),
      this.prisma.designBountyEntry.updateMany({
        where: { bountyId, id: { not: entryId } },
        data:  { status: 'REJECTED' },
      }),
    ]);

    // Notify winner
    await this.emailQueue.add(
      JOBS.SEND_EMAIL,
      {
        to:       entry.designer.email,
        subject:  `You won the bounty "${bounty.title}"!`,
        template: 'bounty-winner',
        data:     {
          firstName:    entry.designer.firstName ?? 'there',
          bountyTitle:  bounty.title,
          winnerPayout: Number(bounty.winnerPayout),
        },
      },
      DEFAULT_JOB_OPTIONS,
    );

    return { success: true, winnerPayout: bounty.winnerPayout };
  }

  // ── Expire old bounties (cron) ────────────────────────────────────────────

  async expireOldBounties(): Promise<void> {
    const expired = await this.prisma.designBounty.findMany({
      where:  { status: 'OPEN', deadline: { lt: new Date() } },
      select: { id: true, stripePaymentIntentId: true, posterId: true },
    });

    for (const bounty of expired) {
      if (bounty.stripePaymentIntentId) {
        await this.stripe.paymentIntents.cancel(bounty.stripePaymentIntentId).catch(() => {});
      }
      await this.prisma.designBounty.update({
        where: { id: bounty.id },
        data:  { status: 'EXPIRED' },
      });
    }
  }

  // ── Seller/User: my bounties ──────────────────────────────────────────────

  async getMyBounties(userId: string) {
    const [posted, entered] = await Promise.all([
      this.prisma.designBounty.findMany({
        where:   { posterId: userId },
        orderBy: { createdAt: 'desc' },
        include: { entries: { select: { id: true, status: true, previewImageUrl: true } } },
      }),
      this.prisma.designBountyEntry.findMany({
        where:   { designerId: userId },
        orderBy: { createdAt: 'desc' },
        include: { bounty: { select: { title: true, budget: true, status: true, deadline: true } } },
      }),
    ]);
    return { posted, entered };
  }
}
