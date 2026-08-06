import { Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { FulfillmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FulfillmentRegistryService } from '../modules/fulfillment/fulfillment-registry.service';
import { FulfillmentConnectionsService } from '../modules/fulfillment/fulfillment-connections.service';
import { FulfillmentLineItem } from '../modules/fulfillment/interfaces/fulfillment-provider.interface';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS, PushStoreOrderJobData } from './queue.constants';

@Processor(QUEUES.FULFILLMENT)
export class FulfillmentProcessor extends WorkerHost {
  private readonly logger = new Logger(FulfillmentProcessor.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly registry:    FulfillmentRegistryService,
    private readonly connections: FulfillmentConnectionsService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.PUSH_STORE_ORDER:
        await this.handlePushStoreOrder(job as Job<PushStoreOrderJobData>);
        break;
      default:
        this.logger.warn(`Unknown fulfillment job: ${job.name}`);
    }
  }

  private async handlePushStoreOrder(job: Job<PushStoreOrderJobData>): Promise<void> {
    const { storeOrderId } = job.data;

    const storeOrder = await this.prisma.storeOrder.findUniqueOrThrow({
      where: { id: storeOrderId },
      include: {
        order: {
          select: {
            id: true, orderNumber: true, shippingName: true, shippingPhone: true, shippingAddress: true,
            shippingCity: true, shippingState: true, shippingZip: true, shippingCountry: true,
            guestEmail: true, user: { select: { email: true } },
          },
        },
        items: {
          select: {
            productId: true, variantId: true, quantity: true,
            product: { select: { name: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
          },
        },
        store: { select: { id: true, name: true, owner: { select: { email: true, firstName: true } } } },
      },
    });

    // productId can be null if the underlying Product was since deleted
    // (OrderItem.product uses onDelete: SetNull) — nothing to map/fulfill then.
    const items = storeOrder.items.filter(
      (i): i is typeof i & { productId: string } => i.productId !== null,
    );

    // Match items against mappings — variantId is nullable, so this can't be a
    // single findUnique against the (productId, variantId) composite key.
    const mappings = await this.prisma.productFulfillmentMapping.findMany({
      where: {
        OR: items.map((i) => ({ productId: i.productId, variantId: i.variantId })),
      },
    });
    if (mappings.length === 0) {
      this.logger.debug(`StoreOrder ${storeOrderId}: no fulfillment mappings — nothing to push`);
      return;
    }

    const mappingFor = (productId: string, variantId: string | null) =>
      mappings.find((m) => m.productId === productId && m.variantId === variantId);

    const mappedItems = items
      .map((i) => ({ item: i, mapping: mappingFor(i.productId, i.variantId) }))
      .filter((x): x is { item: typeof x.item; mapping: NonNullable<typeof x.mapping> } => !!x.mapping);

    if (mappedItems.length === 0) {
      this.logger.debug(`StoreOrder ${storeOrderId}: items exist but none match a mapping — nothing to push`);
      return;
    }

    const byConnection = new Map<string, typeof mappedItems>();
    for (const entry of mappedItems) {
      const list = byConnection.get(entry.mapping.connectionId) ?? [];
      list.push(entry);
      byConnection.set(entry.mapping.connectionId, list);
    }

    const shipTo = {
      fullName:     storeOrder.order.shippingName,
      phone:        storeOrder.order.shippingPhone,
      addressLine1: storeOrder.order.shippingAddress,
      city:         storeOrder.order.shippingCity,
      state:        storeOrder.order.shippingState ?? undefined,
      postalCode:   storeOrder.order.shippingZip,
      country:      storeOrder.order.shippingCountry,
      email:        storeOrder.order.user?.email ?? storeOrder.order.guestEmail ?? undefined,
    };

    for (const [connectionId, entries] of byConnection) {
      const fulfillment = await this.prisma.storeOrderFulfillment.upsert({
        where:  { storeOrderId_connectionId: { storeOrderId, connectionId } },
        create: { storeOrderId, connectionId, status: FulfillmentStatus.PENDING },
        update: {},
      });

      try {
        const conn        = await this.connections.getDecryptedConnection(connectionId);
        const providerImpl = this.registry.resolve(conn.provider);

        const lineItems: FulfillmentLineItem[] = entries.map(({ item, mapping }) => ({
          externalProductId: mapping.externalProductId,
          externalVariantId: mapping.externalVariantId,
          quantity:           item.quantity,
          title:              item.product?.name,
          imageUrl:           item.product?.images[0]?.url,
        }));

        const result = await providerImpl.createOrder(conn, fulfillment.id, lineItems, shipTo);

        await this.prisma.storeOrderFulfillment.update({
          where: { id: fulfillment.id },
          data:  { externalOrderId: result.externalOrderId, status: FulfillmentStatus.SUBMITTED, pushedAt: new Date() },
        });

        this.logger.log(
          `Pushed StoreOrder ${storeOrderId} (${entries.length} item(s)) to connection ${connectionId} → externalOrderId=${result.externalOrderId}`,
        );
      } catch (err) {
        // Re-throw so BullMQ retries the whole job — @OnWorkerEvent('failed')
        // below marks the row FAILED + notifies the seller once attempts run out.
        await this.prisma.storeOrderFulfillment.update({
          where: { id: fulfillment.id },
          data:  { errorMessage: (err as Error).message },
        });
        throw err;
      }
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug(`Fulfillment job completed: id=${job.id} name=${job.name}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(
      `Fulfillment job failed: id=${job.id} name=${job.name} attempt=${job.attemptsMade} — ${error.message}`,
    );

    if (job.name !== JOBS.PUSH_STORE_ORDER) return;
    if (job.attemptsMade < job.opts.attempts!) return; // more retries pending — don't notify yet

    const { storeOrderId } = job.data as PushStoreOrderJobData;

    const failed = await this.prisma.storeOrderFulfillment.updateManyAndReturn({
      where: { storeOrderId, status: { in: [FulfillmentStatus.PENDING] } },
      data:  { status: FulfillmentStatus.FAILED, errorMessage: error.message },
    }).catch(() => []);

    if (failed.length === 0) return;

    const storeOrder = await this.prisma.storeOrder.findUnique({
      where:  { id: storeOrderId },
      select: { store: { select: { name: true, owner: { select: { email: true, firstName: true } } } } },
    });
    if (!storeOrder?.store.owner?.email) return;

    await this.emailQueue.add(JOBS.SEND_EMAIL, {
      to:       storeOrder.store.owner.email,
      template: 'fulfillment-push-failed',
      subject:  `Action needed: an order could not be sent to your fulfillment provider`,
      data: {
        firstName: storeOrder.store.owner.firstName,
        storeName: storeOrder.store.name,
        year:      new Date().getFullYear(),
      },
    }, DEFAULT_JOB_OPTIONS);
  }
}
