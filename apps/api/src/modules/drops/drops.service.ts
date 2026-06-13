import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DropsService {
  private readonly logger = new Logger(DropsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── Public: join waitlist ─────────────────────────────────────────────────

  async joinWaitlist(productSlug: string, email: string, userId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug, isDrop: true, dropWaitlistOpen: true },
      select: { id: true, name: true },
    });
    if (!product) throw new BadRequestException('Product not found or waitlist not open');

    await this.prisma.dropWaitlist.upsert({
      where: { productId_email: { productId: product.id, email } },
      create: { productId: product.id, email, userId: userId ?? null },
      update: {},
    });

    return { success: true };
  }

  // ── Public: waitlist count ────────────────────────────────────────────────

  async getWaitlistCount(productSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug, isDrop: true },
      select: { id: true },
    });
    if (!product) return { count: 0 };

    const count = await this.prisma.dropWaitlist.count({ where: { productId: product.id } });
    return { count };
  }

  // ── Seller: configure drop ────────────────────────────────────────────────

  async configureDrop(
    productId: string,
    storeId: string,
    dto: {
      isDrop: boolean;
      dropLaunchAt?: string;
      dropQuantityLimit?: number | null;
      dropWaitlistOpen?: boolean;
      dropEndAt?: string | null;
    },
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!product) throw new BadRequestException('Product not found');

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        isDrop:            dto.isDrop,
        dropLaunchAt:      dto.dropLaunchAt ? new Date(dto.dropLaunchAt) : null,
        dropQuantityLimit: dto.dropQuantityLimit ?? null,
        dropWaitlistOpen:  dto.dropWaitlistOpen ?? false,
        dropEndAt:         dto.dropEndAt ? new Date(dto.dropEndAt) : null,
        status:            dto.isDrop && dto.dropLaunchAt && new Date(dto.dropLaunchAt) > new Date()
          ? 'DRAFT' : undefined,
      },
      select: {
        id: true, slug: true, isDrop: true, dropLaunchAt: true,
        dropQuantityLimit: true, dropWaitlistOpen: true, dropEndAt: true, status: true,
      },
    });
  }

  // ── BullMQ cron: launch pending drops ────────────────────────────────────

  async launchPendingDrops() {
    const now = new Date();
    const pendingDrops = await this.prisma.product.findMany({
      where: {
        isDrop:       true,
        status:       'DRAFT',
        dropLaunchAt: { lte: now },
      },
      include: {
        store:         { select: { id: true, ownerId: true } },
        dropWaitlists: { select: { email: true, userId: true } },
      },
    });

    for (const product of pendingDrops) {
      await this.prisma.product.update({
        where: { id: product.id },
        data:  { status: 'ACTIVE' },
      });

      // Notify waitlist
      const baseUrl = this.config.get('NEXT_PUBLIC_URL') ?? 'https://dailydaisy.com';
      for (const entry of product.dropWaitlists) {
        await this.emailQueue.add(
          JOBS.SEND_EMAIL,
          {
            to:       entry.email,
            subject:  `🔥 ${product.name} is LIVE!`,
            template: 'drop-launched',
            data:     {
              productName: product.name,
              productUrl:  `${baseUrl}/products/${product.slug}`,
              soldCount:   product.dropSoldCount,
              limit:       product.dropQuantityLimit,
            },
          },
          DEFAULT_JOB_OPTIONS,
        );
      }

      // Notify seller
      await this.prisma.notification.create({
        data: {
          userId:  product.store?.ownerId ?? '',
          type:    'DROP_LIVE',
          title:   'Your drop is live!',
          body:    `${product.name} is now live. ${product.dropWaitlists.length} people were on the waitlist.`,
          data:    { productId: product.id, productSlug: product.slug },
        },
      }).catch(() => {});

      this.logger.log(`Launched drop: ${product.name} (${product.id})`);
    }
  }
}
