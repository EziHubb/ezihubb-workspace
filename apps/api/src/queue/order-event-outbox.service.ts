import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from './event-bus.service';
import { DOMAIN_EVENTS, jobIdOf } from './domain-events';
import { DEFAULT_JOB_OPTIONS, JOBS, QUEUES } from './queue.constants';

export type OrderOutboxEvent = 'ORDER_PAID' | 'ORDER_DELIVERED';

/** Must be called in the SAME transaction as the transition, never after it. */
export async function recordOrderEvent(
  tx: Prisma.TransactionClient,
  eventType: OrderOutboxEvent,
  orderId: string,
) {
  await tx.orderEventOutbox.createMany({
    data: [{ eventType, orderId }],
    skipDuplicates: true,
  });
}

/** DB -> Redis handoff, at least once with retained deterministic queue IDs.
 * No provider/payment calls, historical scan or automatic financial activation.
 * Queue-worker/SMTP delivery and Redis data-loss recovery are separate boundaries. */
@Injectable()
export class OrderEventOutboxService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OrderEventOutboxService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private kickPending = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  onApplicationBootstrap() {
    if (process.env['DISABLE_QUEUE'] === 'true') return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 10_000);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Never keep a provider webhook waiting for a Redis scan after DB commit. */
  kick(): void {
    if (this.kickPending || process.env['DISABLE_QUEUE'] === 'true') return;
    this.kickPending = true;
    setImmediate(() => {
      this.kickPending = false;
      void this.tick();
    }).unref();
  }

  async tick(): Promise<void> {
    if (this.running || process.env['DISABLE_QUEUE'] === 'true') return;
    this.running = true;
    try {
      const now = new Date();
      const due = {
        state: 'PENDING',
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      };
      const rows = await this.prisma.orderEventOutbox.findMany({
        where: due,
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      for (const row of rows) {
        const token = randomUUID();
        const claimed = await this.prisma.orderEventOutbox.updateMany({
          where: { id: row.id, ...due },
          data: {
            leaseToken: token,
            leaseUntil: new Date(Date.now() + 60_000),
            attempts: { increment: 1 },
          },
        });
        if (!claimed.count) continue;
        try {
          const queued = await this.withTimeout(
            this.dispatch(row.eventType, row.orderId),
            20_000,
          );
          await this.prisma.orderEventOutbox.updateMany({
            where: { id: row.id, state: 'PENDING', leaseToken: token },
            data: {
              state: queued ? 'QUEUED' : 'SKIPPED',
              processedAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
            },
          });
        } catch {
          await this.prisma.orderEventOutbox.updateMany({
            where: { id: row.id, state: 'PENDING', leaseToken: token },
            data: {
              leaseToken: null,
              leaseUntil: null,
              nextAttemptAt: new Date(
                Date.now() + Math.min(300_000, 10_000 * (row.attempts + 1)),
              ),
            },
          });
          this.logger.warn(`Order queue handoff pending: ${row.id}`);
        }
      }
    } catch {
      this.logger.error('Order outbox scan failed; durable work retained');
    } finally {
      this.running = false;
    }
  }

  private async dispatch(eventType: string, orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: { select: { status: true } },
        economicContext: { select: { id: true } },
        user: { select: { email: true, firstName: true } },
        items: { select: { productName: true } },
      },
    });
    if (
      !order ||
      order.adminArchivedAt ||
      ['CANCELLED', 'REFUNDED', 'REFUND_REQUESTED', 'DISPUTED'].includes(
        order.status,
      )
    )
      return false;
    if (eventType === 'ORDER_PAID') {
      if (order.economicContext || order.payment?.status !== 'PAID')
        return false;
      await this.events.publish(DOMAIN_EVENTS.ORDER_PAID, orderId);
      return true;
    }
    if (eventType !== 'ORDER_DELIVERED')
      throw new Error('Unsupported order event');
    const email = order.guestEmail ?? order.user?.email;
    if (
      !email ||
      !order.deliveredAt ||
      !['DELIVERED', 'COMPLETED'].includes(order.status)
    )
      return false;
    await this.emailQueue.add(
      JOBS.SEND_EMAIL,
      {
        to: email,
        template: 'order-delivered',
        subject: `Your order ${order.orderNumber} has been delivered!`,
        data: {
          email,
          orderNumber: order.orderNumber,
          orderId,
          firstName: order.user?.firstName ?? undefined,
          items: order.items.map((item) => ({
            productName: item.productName,
            productSlug: '',
          })),
        },
      },
      {
        ...DEFAULT_JOB_OPTIONS,
        jobId: jobIdOf('order-delivered', orderId),
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
    return true;
  }

  private async withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Queue handoff timeout')),
            ms,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
