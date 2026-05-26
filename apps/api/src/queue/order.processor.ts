import { Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  QUEUES,
  JOBS,
  DEFAULT_JOB_OPTIONS,
  OrderConfirmedJobData,
  OrderAutoCompleteJobData,
} from './queue.constants';

@Processor(QUEUES.ORDER_PROCESSING)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.ORDER_CONFIRMED:
        await this.handleOrderConfirmed(job as Job<OrderConfirmedJobData>);
        break;
      case JOBS.ORDER_AUTO_COMPLETE:
        await this.handleOrderAutoComplete(job as Job<OrderAutoCompleteJobData>);
        break;
      case JOBS.DAILY_REVIEW_REMINDERS:
        await this.handleDailyReviewReminders();
        break;
      case JOBS.DAILY_ORDER_AUTO_COMPLETE:
        await this.handleDailyOrderAutoComplete();
        break;
      case JOBS.WEEKLY_CLEANUP_CARTS:
        await this.handleWeeklyCleanupCarts();
        break;
      default:
        this.logger.warn(`Unknown order job: ${job.name}`);
    }
  }

  private async handleOrderConfirmed(job: Job<OrderConfirmedJobData>): Promise<void> {
    const { orderId, orderNumber, customerEmail } = job.data;
    this.logger.log(`Order confirmed: ${orderNumber} (${orderId}) → ${customerEmail}`);

    // Record order status history
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: 'CONFIRMED',
        note: 'Payment confirmed. Order is being processed.',
        createdBy: 'system',
      },
    });

    await this.emailQueue.add(
      JOBS.SEND_EMAIL,
      {
        to: customerEmail,
        template: 'order-confirmation',
        subject: `Order confirmed: ${orderNumber}`,
        data: { orderNumber, orderId, year: new Date().getFullYear() },
      },
      DEFAULT_JOB_OPTIONS,
    );

    this.logger.log(`Order confirmed handler complete: ${orderNumber}`);
  }

  private async handleOrderAutoComplete(job: Job<OrderAutoCompleteJobData>): Promise<void> {
    const { orderId } = job.data;

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: 'COMPLETED',
        note: 'Order auto-completed after 7 days of delivery.',
        createdBy: 'system',
      },
    });

    this.logger.log(`Order auto-completed: ${orderId}`);
  }

  /** Daily: send review reminder emails for orders DELIVERED 7 days ago */
  private async handleDailyReviewReminders(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

    const orders = await this.prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: { lte: sevenDaysAgo },
      },
      include: {
        user: { select: { email: true, firstName: true } },
        items: {
          include: { product: { select: { name: true, slug: true } } },
          take: 1,
        },
      },
      take: 500,
    });

    this.logger.log(`Review reminders: found ${orders.length} eligible orders`);

    let queued = 0;
    for (const order of orders) {
      if (!order.user?.email) continue;
      // Skip if already reviewed
      const hasReview = await this.prisma.review.count({
        where: { userId: order.userId!, orderId: order.id },
      });
      if (hasReview > 0) continue;

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
            reviewUrl: `/products/${order.items[0]?.product?.slug ?? ''}#reviews`,
            unsubscribeUrl: `/account/notifications`,
            year: new Date().getFullYear(),
          },
        },
        DEFAULT_JOB_OPTIONS,
      );
      queued++;
    }

    this.logger.log(`Review reminder emails queued: ${queued}`);
  }

  /** Daily: auto-complete DELIVERED orders older than 7 days */
  private async handleDailyOrderAutoComplete(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

    const { count } = await this.prisma.order.updateMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: { lte: sevenDaysAgo },
      },
      data: { status: 'COMPLETED' },
    });

    if (count > 0) {
      this.logger.log(`Auto-completed ${count} delivered orders`);
    }
  }

  /** Weekly: delete expired guest carts */
  private async handleWeeklyCleanupCarts(): Promise<void> {
    const { count } = await this.prisma.cart.deleteMany({
      where: {
        userId: null,
        expiresAt: { lte: new Date() },
      },
    });

    if (count > 0) {
      this.logger.log(`Cleaned up ${count} expired guest carts`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug(`Order job completed: id=${job.id} name=${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Order job failed: id=${job.id} name=${job.name} attempt=${job.attemptsMade} — ${error.message}`,
    );
  }
}
