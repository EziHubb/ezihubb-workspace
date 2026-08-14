import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from './queue.constants';
import { TargetedOffersService } from '../modules/marketing/targeted-offers.service';

@Processor(QUEUES.ABANDONED_CART)
export class AbandonedCartProcessor extends WorkerHost {
  private readonly logger = new Logger(AbandonedCartProcessor.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    private readonly targetedOffersService: TargetedOffersService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === JOBS.SCAN_ABANDONED_CARTS) {
      return this.scanAbandonedCarts();
    }
    this.logger.warn(`Unknown abandoned-cart job: ${job.name}`);
    return null;
  }

  private async scanAbandonedCarts(): Promise<{ processed: number }> {
    const twoHoursAgo = new Date(Date.now() - 2  * 60 * 60 * 1_000);
    const oneDayAgo   = new Date(Date.now() - 24 * 60 * 60 * 1_000);

    const carts = await this.prisma.cart.findMany({
      where: {
        userId:              { not: null },
        updatedAt:           { gte: oneDayAgo, lte: twoHoursAgo },
        items:               { some: {} },
        abandonedEmailSentAt: null,
        user: {
          cartEmailOptOut:  false,
          isEmailVerified:  true,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, cartEmailToken: true },
        },
        items: {
          include: {
            product: {
              select: {
                name:   true,
                slug:   true,
                basePrice: true,
                storeId: true,
                images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
              },
            },
          },
          take: 3,
        },
      },
      take: 100,
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const apiUrl      = this.config.get<string>('APP_URL',      'http://localhost:3002');
    const year = new Date().getFullYear();
    let processed = 0;

    for (const cart of carts) {
      if (!cart.user?.email) continue;

      let token = cart.user.cartEmailToken;
      if (!token) {
        token = randomBytes(32).toString('hex');
        await this.prisma.user.update({
          where: { id: cart.user.id },
          data:  { cartEmailToken: token },
        });
      }

      await this.emailQueue.add(
        JOBS.SEND_EMAIL,
        {
          to:       cart.user.email,
          subject:  `${cart.user.firstName ?? 'Hey'}, you left something behind!`,
          template: 'abandoned-cart',
          data: {
            firstName:      cart.user.firstName ?? 'there',
            itemCount:      cart.items.length,
            items: cart.items.map((item) => ({
              name:     item.product.name,
              price:    Number(item.product.basePrice).toFixed(2),
              imageUrl: item.product.images[0]?.url ?? '',
              slug:     item.product.slug,
              quantity: item.quantity,
            })),
            cartUrl:        `${frontendUrl}/cart`,
            unsubscribeUrl: `${apiUrl}/api/v1/unsubscribe/cart?token=${token}`,
            year,
          },
        },
        DEFAULT_JOB_OPTIONS,
      );

      await this.prisma.cart.update({
        where: { id: cart.id },
        data:  { abandonedEmailSentAt: new Date() },
      });

      // Etsy "Abandoned basket" targeted offer — a personalized single-use
      // code per store present in the cart (fireOffer is itself a no-op for
      // any store with no active campaign, so this is cheap for the common case).
      const storeIds = [...new Set(cart.items.map((i) => i.product.storeId).filter((id): id is string => !!id))];
      for (const storeId of storeIds) {
        this.targetedOffersService
          .fireOffer(storeId, 'ABANDONED_BASKET', { id: cart.user.id, email: cart.user.email, firstName: cart.user.firstName })
          .catch(() => undefined);
      }

      processed++;
    }

    this.logger.log(`Abandoned cart scan complete: ${processed} emails queued`);
    return { processed };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug(`Abandoned-cart job completed: id=${job.id} name=${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Abandoned-cart job failed: id=${job.id} name=${job.name} — ${error.message}`,
    );
  }
}
