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
  OrderIdJobData,
  FULFILLMENT_JOB_OPTIONS,
} from './queue.constants';
import { OrderStatus } from '@prisma/client';
import { AnalyticsService } from '../modules/analytics/analytics.service';
import { reportDeadJob } from './dead-job-alert';

@Processor(QUEUES.ORDER_PROCESSING)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUES.FULFILLMENT) private readonly fulfillmentQueue: Queue,
    private readonly analytics: AnalyticsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.ORDER_CONFIRMED:
        await this.handleOrderConfirmed(job as Job<OrderIdJobData>);
        break;
      case JOBS.NOTIFY_BUYER_ORDER_PAID:
        await this.handleNotifyBuyerOrderPaid(job as Job<OrderIdJobData>);
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
      case JOBS.CONFIRM_STORE_ORDERS:
        await this.handleConfirmStoreOrders(job as Job<OrderIdJobData>);
        break;
      case JOBS.TRACK_ORDER_ANALYTICS:
        await this.handleTrackOrderAnalytics(job as Job<OrderIdJobData>);
        break;
      default:
        this.logger.warn(`Unknown order job: ${job.name}`);
    }
  }

  /**
   * Records the CONFIRMED status transition and mails the buyer.
   *
   * Takes only an orderId now. It used to be handed orderNumber and
   * customerEmail by the publisher, which is what forced the publisher to look
   * them up — the coupling that kept the payment webhook fat. Reading them here
   * also means a retry sees current data rather than a snapshot taken before
   * the first attempt.
   */
  private async handleOrderConfirmed(job: Job<OrderIdJobData>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.prisma.order.findUnique({
      where:  { id: orderId },
      select: { orderNumber: true, guestEmail: true, user: { select: { email: true } } },
    });
    if (!order) {
      this.logger.warn(`Order ${orderId} vanished before confirmation handling`);
      return;
    }

    // Guarded because this job retries. Without the check a second attempt
    // appended another CONFIRMED row, so an order that hit one transient
    // failure showed the same transition twice in its history.
    const already = await this.prisma.orderStatusHistory.findFirst({
      where: { orderId, status: OrderStatus.CONFIRMED },
      select: { id: true },
    });
    if (!already) {
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.CONFIRMED,
          note: 'Payment confirmed. Order is being processed.',
          createdBy: 'system',
        },
      });
    }

    const customerEmail = order.guestEmail ?? order.user?.email;
    if (customerEmail) {
      await this.emailQueue.add(
        JOBS.SEND_EMAIL,
        {
          to: customerEmail,
          template: 'order-confirmation',
          subject: `Order confirmed: ${order.orderNumber}`,
          data: { orderNumber: order.orderNumber, orderId, year: new Date().getFullYear() },
        },
        { ...DEFAULT_JOB_OPTIONS, jobId: `order-confirmation-mail:${orderId}` },
      );
    }
  }

  /**
   * Buyer-facing receipt, and the download mail for a digital order.
   *
   * Split from handleOrderConfirmed rather than merged into it: these are the
   * two mails the publisher used to send inline, and keeping them a separate
   * subscriber means a failure to send them retries on its own without
   * re-running the status transition.
   */
  private async handleNotifyBuyerOrderPaid(job: Job<OrderIdJobData>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.prisma.order.findUnique({
      where:  { id: orderId },
      select: {
        orderNumber: true,
        isDigital:   true,
        guestEmail:  true,
        user: { select: { email: true } },
      },
    });
    if (!order) return;

    const customerEmail = order.guestEmail ?? order.user?.email;
    if (!customerEmail) return;

    await this.emailQueue.add(
      JOBS.SEND_EMAIL,
      {
        to: customerEmail,
        template: 'order-confirmed',
        subject: `Order ${order.orderNumber} Confirmed`,
        data: { orderNumber: order.orderNumber },
      },
      { ...DEFAULT_JOB_OPTIONS, jobId: `order-paid-mail:${orderId}` },
    );

    if (order.isDigital) {
      const shopUrl = (process.env['NEXT_PUBLIC_URL'] ?? 'https://ezihubb.com').replace(/\/$/, '');
      await this.emailQueue.add(
        JOBS.SEND_EMAIL,
        {
          to: customerEmail,
          template: 'digital-download-ready',
          subject: `Your files are ready — Order ${order.orderNumber}`,
          data: {
            orderNumber: order.orderNumber,
            downloadUrl: `${shopUrl}/orders/${order.orderNumber}`,
            year: new Date().getFullYear(),
          },
        },
        { ...DEFAULT_JOB_OPTIONS, jobId: `digital-download-mail:${orderId}` },
      );
    }
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
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(
      `Order job failed: id=${job.id} name=${job.name} attempt=${job.attemptsMade} — ${error.message}`,
    );

    // This queue carries confirm-store-orders, so a permanent failure here can
    // mean a seller was never credited for an order that was paid for.
    // reportDeadJob decides which names warrant a mail; everything else just
    // gets the marker.
    await reportDeadJob(job, error, { logger: this.logger, emailQueue: this.emailQueue });
  }

  /**
   * Confirms every StoreOrder on an order and credits each seller.
   *
   * Moved off the Stripe webhook, where it ran as a bare promise with a
   * .catch(log): a failure there confirmed no seller order and credited no
   * store, permanently, with only a log line to show for it.
   *
   * Being retryable is exactly what makes the idempotency below mandatory.
   * The old version read the rows and then wrote unconditionally, so a second
   * run would increment totalOrders and totalRevenue a second time. That was
   * safe only because the webhook guarded it from outside (a Redis lock on the
   * Stripe event id, plus an early return once the payment is PAID) — and
   * neither of those guards reaches inside a BullMQ retry.
   */
  private async handleConfirmStoreOrders(job: Job<OrderIdJobData>): Promise<void> {
    const { orderId } = job.data;

    const storeOrders = await this.prisma.storeOrder.findMany({
      where:   { orderId },
      include: { store: { include: { owner: { select: { email: true, firstName: true } } } } },
    });

    for (const so of storeOrders) {
      // Compare-and-set: the status filter lives in the WHERE clause, so the
      // transition is decided by the database, not by a value we read earlier
      // and might be acting on stale. count === 0 means somebody else already
      // confirmed this one, and the credit below must not run again.
      const credited = await this.prisma.$transaction(async (tx) => {
        const res = await tx.storeOrder.updateMany({
          where: { id: so.id, status: { not: OrderStatus.CONFIRMED } },
          data:  { status: OrderStatus.CONFIRMED },
        });
        if (res.count === 0) return false;

        await tx.store.update({
          where: { id: so.storeId },
          data:  {
            totalOrders:  { increment: 1 },
            totalRevenue: { increment: Number(so.sellerEarnings) },
          },
        });
        return true;
      });

      if (!credited) {
        this.logger.debug(`StoreOrder ${so.id} already confirmed — skipping credit`);
      }

      // Enqueued unconditionally, NOT gated on `credited`. If a previous
      // attempt confirmed the row and then died before queueing these, gating
      // would drop the seller notification and the fulfillment push for good.
      // Duplicate work is prevented by the deterministic jobId instead, which
      // BullMQ dedupes — the right place for it, because it holds no matter
      // which step the earlier attempt failed at.
      if (so.store.owner?.email) {
        await this.emailQueue.add(JOBS.SEND_EMAIL, {
          to:       so.store.owner.email,
          template: 'new-store-order',
          subject:  `New order for ${so.store.name}`,
          data: {
            firstName: so.store.owner.firstName,
            storeName: so.store.name,
            orderId:   so.id,
            earnings:  Number(so.sellerEarnings).toFixed(2),
          },
        }, { ...DEFAULT_JOB_OPTIONS, jobId: `store-order-email:${so.id}` });
      }

      // A duplicate push here would place a second REAL print order with the
      // provider, so the jobId matters more than it does for the email.
      await this.fulfillmentQueue.add(
        JOBS.PUSH_STORE_ORDER,
        { storeOrderId: so.id },
        { ...FULFILLMENT_JOB_OPTIONS, jobId: `store-order-fulfil:${so.id}` },
      );
    }
  }

  /**
   * Order analytics + GA4 purchase event.
   *
   * Telemetry, so a failure costs a datapoint rather than money — but it was
   * still a bare promise off the webhook, which meant any blip silently lost
   * the purchase event that revenue reporting is built on.
   */
  private async handleTrackOrderAnalytics(job: Job<OrderIdJobData>): Promise<void> {
    const { orderId } = job.data;

    const o = await this.prisma.order.findUnique({
      where:  { id: orderId },
      select: {
        orderNumber: true,
        total: true,
        items: { select: { productId: true, productName: true, quantity: true, unitPrice: true } },
      },
    });
    if (!o) return;

    await Promise.all([
      this.analytics.trackOrderConfirmed({
        id: orderId,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        items: o.items.map((i) => ({ productId: i.productId ?? '', quantity: i.quantity })),
      }),
      this.analytics.sendToGA4(orderId, [
        {
          name: 'purchase',
          params: {
            transaction_id: o.orderNumber,
            value: Number(o.total),
            currency: 'USD',
            items: o.items.map((i) => ({
              item_id:   i.productId,
              item_name: i.productName,
              price:     Number(i.unitPrice),
              quantity:  i.quantity,
            })),
          },
        },
      ]),
    ]);
  }
}
