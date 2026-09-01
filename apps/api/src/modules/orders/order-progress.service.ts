import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderProgressStepKind, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { syncOrderStatusFromShops } from './order-status-sync';
import type { OrderQueueQueryDto, QueueSort, QueueView, ShipByBucket } from './dto/order-queue.dto';
import {
  CUSTOM_STEP_SORT_ORDER,
  ensureFixedOrderProgressSteps,
  publicStatusForProgressKind,
} from './order-progress.defaults';

/**
 * A shop's own order workflow.
 *
 * Five locked milestones mirror the buyer timeline. Seller-defined detail
 * belongs inside the production phase and maps to public IN_PRODUCTION.
 * Cancellation and refunds remain outside the pipeline because a seller must
 * never be able to rename those records.
 */

/**
 * Statuses that never belong in the seller's queue.
 *
 * One list, used by both the query and the placement pass. They disagreed
 * once: placement skipped refunded orders while the query still returned them,
 * so a refunded order appeared under "All" with no step and was missing from
 * every individual tab — present and unreachable at the same time.
 */
export const OFF_QUEUE_STATUSES = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
] as const;

/**
 * Keeps the seller queue consistent even when an older Order and StoreOrder
 * disagree. The parent Order is the source of truth for cancellation; the
 * child status is still checked because it is the seller's fulfilment row.
 */
export function queueLifecycleWhere(view: QueueView = 'active'): Prisma.StoreOrderWhereInput {
  if (view === 'cancelled') {
    return {
      OR: [
        { status: OrderStatus.CANCELLED },
        { order: { status: OrderStatus.CANCELLED } },
      ],
    };
  }

  return {
    status: { notIn: [...OFF_QUEUE_STATUSES] },
    order:  { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] } },
  };
}

export interface ProgressStepInput {
  /** Absent for a step being created. */
  id?:   string;
  name:  string;
}

@Injectable()
export class OrderProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A shop's steps, in pipeline order.
   *
   * Creates the five locked milestones on first read rather than requiring every
   * store-creation path to remember them. A shop that predates this feature,
   * or one created by a code path that forgot, still gets a usable pipeline
   * the first time someone opens Orders.
   */
  async listSteps(storeId: string) {
    return ensureFixedOrderProgressSteps(this.prisma, storeId);
  }

  /**
   * Puts any paid order that is not yet on the pipeline onto the first step.
   *
   * Deliberately not done at the payment call sites. There are three of them
   * (card, PayPal, webhook replay), they sit in the middle of money-handling
   * transactions, and none of them touches StoreOrder today — adding a
   * per-store lookup to all three to solve a display problem is a poor trade.
   * Doing it here means no code path can create an order that is invisible in
   * the seller's queue, including ones written later that never heard of
   * progress steps.
   *
   * Idempotent, and cheap: the WHERE matches nothing on every call after the
   * first for a given order.
   */
  private async placeUnassigned(
    storeId: string,
    steps: { id: string; kind: OrderProgressStepKind }[],
  ) {
    const fixedStatuses: [OrderProgressStepKind, OrderStatus][] = [
      [OrderProgressStepKind.CONFIRMED,     OrderStatus.CONFIRMED],
      [OrderProgressStepKind.IN_PRODUCTION, OrderStatus.IN_PRODUCTION],
      [OrderProgressStepKind.SHIPPED,       OrderStatus.SHIPPED],
      [OrderProgressStepKind.DELIVERED,     OrderStatus.DELIVERED],
      [OrderProgressStepKind.COMPLETED,     OrderStatus.COMPLETED],
    ];

    for (const [kind, status] of fixedStatuses) {
      const step = steps.find((candidate) => candidate.kind === kind);
      if (!step) continue;
      await this.prisma.storeOrder.updateMany({
        where: { storeId, progressStepId: null, status },
        data:  { progressStepId: step.id },
      });
    }
  }

  /** Steps plus how many orders sit on each — the counts beside the tabs. */
  async listStepsWithCounts(storeId: string) {
    const steps = await this.listSteps(storeId);

    await this.placeUnassigned(storeId, steps);

    // Same status filter the queue itself uses. Without it a refunded order
    // keeps the step it was last on and is still counted, so the badge says 5
    // while the tab shows 4 — and the seller trusts the badge.
    const counts = await this.prisma.storeOrder.groupBy({
      by:    ['progressStepId'],
      where: {
        storeId,
        progressStepId: { not: null },
        ...queueLifecycleWhere('active'),
      },
      _count: { _all: true },
    });

    const byId = new Map(counts.map((c) => [c.progressStepId, c._count._all]));
    return steps.map((s) => ({ ...s, orderCount: byId.get(s.id) ?? 0 }));
  }

  /**
   * Replaces a shop's custom steps with the list the editor saved.
   *
   * Ids of surviving steps are preserved rather than deleted and recreated.
   * Every StoreOrder points at a step id, so a delete-all-recreate would strip
   * every order out of the pipeline on each save — the same shape of bug that
   * an earlier feature hit when it recreated rows another table pointed at.
   *
   * Deleting a step moves its orders back one place rather than leaving them
   * with a dangling pointer. An order that vanishes from every tab is worse
   * than one in the wrong tab: nobody goes looking for what they cannot see.
   */
  async saveSteps(storeId: string, input: ProgressStepInput[]) {
    const names = input.map((s) => s.name.trim());

    if (names.some((n) => !n)) {
      throw new BadRequestException('A step name cannot be empty');
    }
    // Checked here rather than by a unique constraint: the editor saves the
    // whole list at once, so two steps swapping names collide on a
    // per-statement check inside the transaction even though the final state
    // is fine.
    const lowered = names.map((n) => n.toLowerCase());
    if (new Set(lowered).size !== lowered.length) {
      throw new BadRequestException('Two steps cannot share a name');
    }

    const existing = await this.listSteps(storeId);
    const locked   = existing.filter((s) => s.kind !== OrderProgressStepKind.CUSTOM);
    const inProductionStep = locked.find((s) => s.kind === OrderProgressStepKind.IN_PRODUCTION);
    if (!inProductionStep) throw new BadRequestException('This shop is missing its required steps');

    const lockedNames = new Set(locked.map((step) => step.name.toLowerCase()));
    if (lowered.some((n) => lockedNames.has(n))) {
      throw new BadRequestException('A step cannot reuse a required step name');
    }

    const customExisting = existing.filter((s) => s.kind === OrderProgressStepKind.CUSTOM);
    const keptIds        = new Set(input.map((s) => s.id).filter(Boolean) as string[]);

    const unknown = [...keptIds].filter((id) => !customExisting.some((s) => s.id === id));
    if (unknown.length) {
      throw new BadRequestException('A step in this list does not belong to this shop');
    }

    // The same id twice would be two updates to one row: the last name and
    // position win and the other entry disappears without a word. Rejecting is
    // the only honest answer — there is no way to satisfy both.
    const sentIds = input.map((s) => s.id).filter(Boolean) as string[];
    if (sentIds.length !== keptIds.size) {
      throw new BadRequestException('The same step appears more than once');
    }

    const removed = customExisting.filter((s) => !keptIds.has(s.id));

    return this.prisma.$transaction(async (tx) => {
      const removedIds = removed.map((step) => step.id);
      const rehomed = removedIds.length
        ? await tx.storeOrder.findMany({
            where:  { storeId, progressStepId: { in: removedIds } },
            select: { orderId: true },
          })
        : [];

      // Rehome orders before the step under them disappears. They go back to
      // IN_PRODUCTION rather than to the nearest surviving neighbour: after a save that
      // deleted and reordered several steps at once there is no honest
      // "nearest", and a seller who deleted the step an order was in has to
      // look at that order again anyway.
      for (const step of removed) {
        await tx.storeOrder.updateMany({
          where: { storeId, progressStepId: step.id },
          data:  { progressStepId: inProductionStep.id, status: OrderStatus.IN_PRODUCTION },
        });
      }

      if (removed.length) {
        await tx.orderProgressStep.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
      }

      // Custom detail always stays inside the production phase, after the
      // locked IN_PRODUCTION milestone and before SHIPPED.
      for (let i = 0; i < input.length; i++) {
        const sortOrder = CUSTOM_STEP_SORT_ORDER + i;
        const name      = names[i];
        const id        = input[i].id;

        if (id) {
          await tx.orderProgressStep.update({ where: { id }, data: { name, sortOrder } });
        } else {
          await tx.orderProgressStep.create({
            data: { storeId, name, sortOrder, kind: OrderProgressStepKind.CUSTOM },
          });
        }
      }

      if (rehomed.length) {
        await syncOrderStatusFromShops(tx, rehomed.map((row) => row.orderId));
      }

      return tx.orderProgressStep.findMany({ where: { storeId }, orderBy: { sortOrder: 'asc' } });
    });
  }

  /**
   * Moves orders to a step.
   *
   * Fixed milestones map to their matching public status. Every custom step
   * maps to IN_PRODUCTION. SHIPPED is reserved for the dispatch form because
   * tracking information and buyer notifications belong to that transition.
   */
  async moveOrders(storeId: string, storeOrderIds: string[], stepId: string) {
    const step = await this.prisma.orderProgressStep.findFirst({ where: { id: stepId, storeId } });
    if (!step) throw new NotFoundException('Step not found');

    const owned = await this.prisma.storeOrder.findMany({
      where:  { id: { in: storeOrderIds }, storeId },
      select: { id: true, orderId: true },
    });
    if (!owned.length) throw new NotFoundException('No matching orders');

    if (step.kind === OrderProgressStepKind.SHIPPED) {
      throw new BadRequestException('Use Mark as dispatched to move an order to Shipped');
    }

    const ids          = owned.map((o) => o.id);
    const publicStatus = publicStatusForProgressKind(step.kind);

    // Unchecked, not the checked variant: `progressStepId` is a relation's
    // foreign key, and only the unchecked input lets it be set as a plain
    // scalar rather than through a nested `connect`.
    const data: Prisma.StoreOrderUncheckedUpdateManyInput = {
      progressStepId: step.id,
      status:         publicStatus,
      ...(publicStatus === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.storeOrder.updateMany({ where: { id: { in: ids } }, data });

      await syncOrderStatusFromShops(tx, owned.map((o) => o.orderId));
    });

    return { moved: ids.length, stepId: step.id };
  }


  /**
   * The seller's work queue — one row per store order, in dispatch order.
   *
   * Returned flat rather than pre-grouped by ship-by date. The screen groups
   * consecutive rows under a date heading, but a grouped payload would make
   * pagination lie: a page boundary falling inside a group would produce two
   * headings for the same day with two different counts.
   */
  async listQueue(storeId: string, query: OrderQueueQueryDto) {
    const page  = query.page  ?? 1;
    // PaginationDto already rejects anything above 48, so this is a floor for
    // a missing value, not a second ceiling. It said 100 before, which read as
    // if the endpoint accepted 100 — it never could.
    const limit = query.limit ?? 24;

    // Place stragglers here too, not only in listStepsWithCounts. The page
    // fires both requests at once, so relying on the other one having landed
    // first is a race: lose it, and a newly paid order is missing from the tab
    // it belongs to until something triggers a refetch.
    const steps = await this.listSteps(storeId);
    await this.placeUnassigned(storeId, steps);

    const cancelledView = query.view === 'cancelled';
    const andWhere: Prisma.StoreOrderWhereInput[] = [queueLifecycleWhere(query.view)];
    const where: Prisma.StoreOrderWhereInput = {
      storeId,
      AND: andWhere,
      ...(!cancelledView && query.stepId ? { progressStepId: query.stepId } : {}),
      ...(query.upgradeRequested !== undefined ? { deliveryUpgradeRequested: query.upgradeRequested } : {}),
      ...this.shipByWhere(query.shipBy),
    };

    const orderWhere: Prisma.OrderWhereInput = {};
    if (query.destination)          orderWhere.shippingCountry = query.destination;
    if (query.isGift !== undefined) orderWhere.isGift          = query.isGift;
    if (query.hasNote !== undefined) {
      orderWhere.note = query.hasNote ? { not: null } : null;
    }
    if (query.search) {
      orderWhere.OR = [
        { orderNumber:  { contains: query.search, mode: 'insensitive' } },
        { shippingName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(orderWhere).length) andWhere.push({ order: orderWhere });

    // Personalisation lives on the item, not the order: an order is
    // "personalized" when any line in it carries customisation data.
    if (query.isPersonalized !== undefined) {
      where.items = query.isPersonalized
        ? { some: { customizationData: { not: Prisma.DbNull } } }
        : { every: { customizationData: { equals: Prisma.DbNull } } };
    }

    const [rows, total, cancelledCount] = await this.prisma.$transaction([
      this.prisma.storeOrder.findMany({
        where,
        orderBy: this.queueOrderBy(query.sort),
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          progressStep: { select: { id: true, name: true, kind: true } },
          order: {
            select: {
              id: true, orderNumber: true, createdAt: true, couponCode: true,
              status: true, cancelledAt: true, cancelReason: true,
              isGift: true, note: true,
              shippingName: true, shippingAddress: true, shippingCity: true,
              shippingState: true, shippingZip: true, shippingCountry: true,
              shippingMethod: true,
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
          items: {
            select: {
              id: true, quantity: true, productName: true, productSlug: true,
              productImageUrl: true, sku: true, variantName: true,
              variantSnapshot: true, customizationData: true, previewUrl: true,
            },
          },
        },
      }),
      this.prisma.storeOrder.count({ where }),
      this.prisma.storeOrder.count({
        where: { storeId, ...queueLifecycleWhere('cancelled') },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id:          row.id,
        orderId:     row.orderId,
        orderNumber: row.order.orderNumber,
        status:      row.order.status === OrderStatus.CANCELLED
          ? OrderStatus.CANCELLED
          : row.status,
        cancelledAt: row.order.cancelledAt,
        cancelReason: row.order.cancelReason,
        step:        row.progressStep,
        shipByDate:  row.shipByDate,
        orderedAt:   row.order.createdAt,
        total:       Number(row.subtotal)
          + Number(row.shippingCost)
          - Number(row.shippingSubsidy)
          - Number(row.discountAmount),
        shippingCost: Number(row.shippingCost),
        shippingSubsidy: Number(row.shippingSubsidy),
        shippingMethod: row.order.shippingMethod,
        couponCode:  row.order.couponCode,
        isGift:      row.order.isGift,
        note:        row.order.note,
        upgradeRequested: row.deliveryUpgradeRequested,
        buyer: {
          id:    row.order.user?.id ?? null,
          // The name on the parcel wins over the account name — that is who
          // the seller is packing for. Guests have no account at all.
          name:  row.order.shippingName
                 ?? ([row.order.user?.firstName, row.order.user?.lastName].filter(Boolean).join(' ') || null),
        },
        shipTo: {
          name:    row.order.shippingName,
          address: row.order.shippingAddress,
          city:    row.order.shippingCity,
          state:   row.order.shippingState,
          zip:     row.order.shippingZip,
          country: row.order.shippingCountry,
        },
        items: row.items.map((i) => ({
          id: i.id, quantity: i.quantity, name: i.productName, slug: i.productSlug,
          imageUrl: i.previewUrl ?? i.productImageUrl, sku: i.sku,
          variantName: i.variantName, variantSnapshot: i.variantSnapshot,
          isPersonalized: i.customizationData !== null,
        })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      cancelledCount,
    };
  }

  /** Distinct destination countries in this shop's queue, for the filter list. */
  async listDestinations(storeId: string) {
    const rows = await this.prisma.storeOrder.findMany({
      where:  { storeId, ...queueLifecycleWhere('active') },
      select: { order: { select: { shippingCountry: true } } },
      distinct: ['orderId'],
    });

    const counts = new Map<string, number>();
    for (const r of rows) {
      const c = r.order.shippingCountry;
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Turns a named bucket into a date window, from the server's clock.
   *
   * "Overdue" deliberately excludes rows with no date at all: an order nobody
   * ever promised a date for is not late, and lumping the two together would
   * hide real misses in a pile of unset ones.
   */
  private shipByWhere(bucket?: ShipByBucket): Prisma.StoreOrderWhereInput {
    if (!bucket || bucket === 'all') return {};
    if (bucket === 'none') return { shipByDate: null };

    const start = new Date(); start.setHours(0, 0, 0, 0);
    const dayAfter = (days: number) => {
      const d = new Date(start); d.setDate(d.getDate() + days); return d;
    };

    switch (bucket) {
      case 'overdue':  return { shipByDate: { not: null, lt: start } };
      case 'today':    return { shipByDate: { gte: start, lt: dayAfter(1) } };
      case 'tomorrow': return { shipByDate: { gte: dayAfter(1), lt: dayAfter(2) } };
      case 'week':     return { shipByDate: { gte: start, lt: dayAfter(7) } };
    }
  }

  private queueOrderBy(sort?: QueueSort): Prisma.StoreOrderOrderByWithRelationInput[] {
    switch (sort) {
      case 'newest': return [{ createdAt: 'desc' }];
      case 'oldest': return [{ createdAt: 'asc' }];
      case 'total':  return [{ subtotal: 'desc' }];
      // Default. Nulls last, so orders with a real promise lead the queue —
      // Postgres sorts NULLs first on ASC unless told otherwise.
      default: return [{ shipByDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }];
    }
  }

  /**
   * Flags an order as a gift from the seller's side.
   *
   * `isGift` lives on Order, not StoreOrder, so on a basket split across
   * several shops this marks the whole order — the gift receipt and the
   * omitted prices are a property of the parcel the buyer receives, not of one
   * shop's part of it. Ownership is still checked through this shop's own
   * StoreOrder, so a seller can only touch an order they are part of.
   */
  async setGift(storeId: string, storeOrderId: string, isGift: boolean) {
    const row = await this.prisma.storeOrder.findFirst({
      where:  { id: storeOrderId, storeId },
      select: { orderId: true },
    });
    if (!row) throw new NotFoundException('Order not found');

    await this.prisma.order.update({ where: { id: row.orderId }, data: { isGift } });
    return { isGift };
  }

  /** The dispatch promise, editable because a date that cannot move gets missed instead. */
  async setShipByDate(storeId: string, storeOrderId: string, shipByDate: Date | null) {
    const { count } = await this.prisma.storeOrder.updateMany({
      where: { id: storeOrderId, storeId },
      data:  { shipByDate },
    });
    if (!count) throw new NotFoundException('Order not found');
    return { shipByDate };
  }
}
