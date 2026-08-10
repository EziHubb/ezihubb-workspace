import { Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { FulfillmentStatus, ProductImageType, PrintSide } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { FulfillmentRegistryService } from '../modules/fulfillment/fulfillment-registry.service';
import { FulfillmentConnectionsService } from '../modules/fulfillment/fulfillment-connections.service';
import { FulfillmentLineItem } from '../modules/fulfillment/interfaces/fulfillment-provider.interface';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS, PushStoreOrderJobData } from './queue.constants';

type Side = 'FRONT' | 'BACK' | 'SLEEVE' | 'HOOD';

/** Shape of OrderItem.customizationData for a personalized item — see
 * apps/client/src/lib/customizer/types.ts's CustomizationPayload. Only the
 * fields relevant to sourcing a print file are declared here. */
interface CustomizationDataShape {
  fields?: Record<string, { type?: string; processedValue?: string; bgRemoved?: boolean }>;
}

@Processor(QUEUES.FULFILLMENT)
export class FulfillmentProcessor extends WorkerHost {
  private readonly logger = new Logger(FulfillmentProcessor.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly storage:     StorageService,
    private readonly registry:    FulfillmentRegistryService,
    private readonly connections: FulfillmentConnectionsService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {
    super();
  }

  /**
   * Resolves the print files to send for one order item: starts from the
   * product's own PRINT_FILE images (keyed by side), then — if this item was
   * personalized and the customer's own upload was background-removed —
   * overrides FRONT with that customer image instead (it's more accurate for
   * this specific order than the product's generic print file).
   *
   * v1 limitation: CustomizationPayload.fields is keyed by arbitrary template
   * field ids, not by print side (only a single-image template exists today —
   * see customization.service.ts's DEMO_TEMPLATE TODO), so the first image
   * field with bgRemoved:true is treated as FRONT. Revisit once multi-field/
   * multi-side templates exist.
   */
  private resolvePrintFiles(item: {
    product: { images: { url: string; type: ProductImageType; printSide: PrintSide | null }[] } | null;
    customizationData: unknown;
  }): Partial<Record<Side, string>> {
    const printFiles: Partial<Record<Side, string>> = {};
    for (const img of item.product?.images ?? []) {
      if (img.type === ProductImageType.PRINT_FILE && img.printSide) {
        printFiles[img.printSide] = img.url;
      }
    }

    const customization = item.customizationData as CustomizationDataShape | null;
    const bgRemovedField = Object.values(customization?.fields ?? {}).find(
      (f) => f.type === 'image' && f.bgRemoved && f.processedValue,
    );
    if (bgRemovedField?.processedValue) {
      printFiles.FRONT = this.storage.getPublicUrl(bgRemovedField.processedValue);
    }

    return printFiles;
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
            productId: true, variantId: true, quantity: true, customizationData: true,
            product: {
              select: {
                name: true,
                images: { select: { url: true, isPrimary: true, type: true, printSide: true } },
              },
            },
          },
        },
        store: { select: { id: true, name: true, fulfillmentMode: true, owner: { select: { email: true, firstName: true } } } },
      },
    });

    if (storeOrder.store.fulfillmentMode === 'MANUAL') {
      this.logger.debug(`StoreOrder ${storeOrderId}: store is on manual fulfillment — skipping auto-push`);
      return;
    }

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

    // POD fulfillment only ever runs for physical orders (a digital order has
    // no ProductFulfillmentMapping to push), so these are never actually null
    // in practice — the fallbacks just satisfy the now-nullable Order columns.
    const shipTo = {
      fullName:     storeOrder.order.shippingName ?? '',
      phone:        storeOrder.order.shippingPhone ?? '',
      addressLine1: storeOrder.order.shippingAddress ?? '',
      city:         storeOrder.order.shippingCity ?? '',
      state:        storeOrder.order.shippingState ?? undefined,
      postalCode:   storeOrder.order.shippingZip ?? '',
      country:      storeOrder.order.shippingCountry ?? '',
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
          imageUrl:           item.product?.images.find((i) => i.isPrimary && i.type === ProductImageType.MOCKUP)?.url,
          printFiles:         this.resolvePrintFiles(item),
        }));

        // Merchize prints from the isolated design file, not the mockup photo
        // — never silently fall back to sending the wrong image as artwork.
        if (conn.provider === 'MERCHIZE') {
          const missingNames = entries
            .filter((_, i) => !lineItems[i].printFiles?.FRONT)
            .map(({ item }) => item.product?.name ?? 'unknown product');
          if (missingNames.length > 0) {
            const message = `Missing print file: ${[...new Set(missingNames)].join(', ')} — upload or generate a FRONT print file before this order can be sent to Merchize.`;
            await this.prisma.storeOrderFulfillment.update({
              where: { id: fulfillment.id },
              data:  { status: FulfillmentStatus.FAILED, errorMessage: message },
            });
            this.logger.warn(`StoreOrder ${storeOrderId}: ${message}`);
            throw new UnrecoverableError(message);
          }
        }

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

    // A non-retryable data problem (e.g. missing print file) already marked
    // its row FAILED with a specific errorMessage directly at the throw site
    // and never gets retried — attemptsMade stays at 1, so the usual
    // "wait for retries to exhaust" check below must not gate this case, or
    // the seller notification would be silently skipped.
    const isNonRetryable = error instanceof UnrecoverableError;
    if (!isNonRetryable && job.attemptsMade < job.opts.attempts!) return; // more retries pending — don't notify yet

    const { storeOrderId } = job.data as PushStoreOrderJobData;

    if (!isNonRetryable) {
      // Generic/transient failure (network error, provider API down, etc.) —
      // still sitting in PENDING since no row was pre-marked FAILED for it.
      await this.prisma.storeOrderFulfillment.updateMany({
        where: { storeOrderId, status: FulfillmentStatus.PENDING },
        data:  { status: FulfillmentStatus.FAILED, errorMessage: error.message },
      }).catch(() => undefined);
    }

    const failed = await this.prisma.storeOrderFulfillment.findMany({
      where: { storeOrderId, status: FulfillmentStatus.FAILED },
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
        firstName:    storeOrder.store.owner.firstName,
        storeName:    storeOrder.store.name,
        errorMessage: failed[0].errorMessage ?? error.message,
        year:         new Date().getFullYear(),
      },
    }, DEFAULT_JOB_OPTIONS);
  }
}
