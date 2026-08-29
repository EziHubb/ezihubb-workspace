import { OrderProgressStepKind, OrderStatus, Prisma } from '@prisma/client';

/** Stable milestones shared by the seller queue and buyer timeline. */
export const FIXED_ORDER_PROGRESS_STEPS = [
  { name: 'Confirmed',     kind: OrderProgressStepKind.CONFIRMED,     sortOrder: 0 },
  { name: 'In Production', kind: OrderProgressStepKind.IN_PRODUCTION, sortOrder: 100 },
  { name: 'Shipped',       kind: OrderProgressStepKind.SHIPPED,       sortOrder: 800 },
  { name: 'Delivered',     kind: OrderProgressStepKind.DELIVERED,     sortOrder: 900 },
  { name: 'Completed',     kind: OrderProgressStepKind.COMPLETED,     sortOrder: 1000 },
] as const;

/** Custom production detail stays between IN_PRODUCTION and SHIPPED. */
export const CUSTOM_STEP_SORT_ORDER = 200;

type ProgressStepDb = Pick<Prisma.TransactionClient, 'orderProgressStep'>;

/** Self-heals stores created before (or outside) the normal setup flow. */
export async function ensureFixedOrderProgressSteps(db: ProgressStepDb, storeId: string) {
  const existing = await db.orderProgressStep.findMany({
    where:   { storeId },
    orderBy: { sortOrder: 'asc' },
  });
  const present = new Set(existing.map((step) => step.kind));
  const missing = FIXED_ORDER_PROGRESS_STEPS.filter((step) => !present.has(step.kind));

  if (missing.length) {
    await db.orderProgressStep.createMany({
      data: missing.map((step) => ({ storeId, ...step })),
    });
  }

  return missing.length
    ? db.orderProgressStep.findMany({ where: { storeId }, orderBy: { sortOrder: 'asc' } })
    : existing;
}

/** What the buyer sees while a seller's card sits on this workflow step. */
export function publicStatusForProgressKind(kind: OrderProgressStepKind): OrderStatus {
  switch (kind) {
    case OrderProgressStepKind.CONFIRMED:     return OrderStatus.CONFIRMED;
    case OrderProgressStepKind.IN_PRODUCTION:
    case OrderProgressStepKind.CUSTOM:        return OrderStatus.IN_PRODUCTION;
    case OrderProgressStepKind.SHIPPED:       return OrderStatus.SHIPPED;
    case OrderProgressStepKind.DELIVERED:     return OrderStatus.DELIVERED;
    case OrderProgressStepKind.COMPLETED:     return OrderStatus.COMPLETED;
  }
}
